import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PersonalBest } from './entities/personal-best.entity';
import { CompetitionResult } from './entities/competition-result.entity';
import { CourseType } from './entities/competition.entity';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

export interface SeasonBest {
  distance: number;
  stroke: string;
  course: CourseType;
  time: number;
  result_id: string;
  achieved_at: string | null;
}

/**
 * Maintains the personal_bests table and the is_pb flags on results.
 *
 * PBs are stored per member/distance/stroke/course and recomputed from
 * scratch for a member whenever any of their results change. Relay swims and
 * DQs never count. A result's is_pb flag means "was a PB at the time it was
 * swum" (strictly faster than every earlier eligible result for the same
 * event and course), so history stays truthful when older meets are imported
 * later.
 */
@Injectable()
export class PersonalBestsService {
  private readonly logger = new Logger(PersonalBestsService.name);

  constructor(
    @InjectRepository(PersonalBest)
    private readonly pbRepo: Repository<PersonalBest>,
    @InjectRepository(CompetitionResult)
    private readonly resultRepo: Repository<CompetitionResult>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getForMember(memberId: string): Promise<PersonalBest[]> {
    return await this.scoped.scopedFind(this.pbRepo, {
      where: { member_id: memberId },
      order: { course: 'ASC', stroke: 'ASC', distance: 'ASC' },
    });
  }

  /**
   * Best time per event swum since the start of the current swimming season
   * (1 September, matching the British Swimming season).
   */
  async getSeasonBests(memberId: string): Promise<{ seasonStart: string; bests: SeasonBest[] }> {
    const seasonStart = PersonalBestsService.currentSeasonStart();
    const results = await this.eligibleResultsForMember(memberId);

    const bests = new Map<string, SeasonBest>();
    for (const result of results) {
      const swumAt = this.effectiveSwumAt(result);
      if (!swumAt || new Date(swumAt) < seasonStart) continue;
      const course = this.effectiveCourse(result);
      const key = `${result.distance}|${result.stroke}|${course}`;
      const time = Number(result.time);
      const existing = bests.get(key);
      if (!existing || time < existing.time) {
        bests.set(key, {
          distance: result.distance,
          stroke: result.stroke,
          course,
          time,
          result_id: result.result_id,
          achieved_at: swumAt ? String(swumAt) : null,
        });
      }
    }

    return {
      seasonStart: seasonStart.toISOString().slice(0, 10),
      bests: Array.from(bests.values()).sort(
        (a, b) =>
          a.course.localeCompare(b.course) ||
          a.stroke.localeCompare(b.stroke) ||
          a.distance - b.distance,
      ),
    };
  }

  /**
   * Rebuild the member's personal_bests rows and result is_pb flags from
   * their full (club-scoped) result history. Returns how many PB rows were
   * created or improved, so callers like the file importer can report it.
   */
  async recomputeForMember(memberId: string): Promise<{ improved: number }> {
    const clubId = this.tenantContext.getClubId();
    const results = await this.scoped.scopedFind(this.resultRepo, {
      where: { member_id: memberId },
      relations: ['competition'],
    });

    // Chronological order: the date actually swum (falling back to the meet
    // start date), then row creation for same-day swims.
    const eligible = results
      .filter((r) => !r.dq && !r.is_relay && Number(r.time) > 0)
      .sort((a, b) => {
        const swumA = this.effectiveSwumAt(a);
        const swumB = this.effectiveSwumAt(b);
        const dateA = swumA ? new Date(swumA).getTime() : 0;
        const dateB = swumB ? new Date(swumB).getTime() : 0;
        return dateA - dateB || a.created_at.getTime() - b.created_at.getTime();
      });

    // Walk history per event key, flagging results that beat the running best.
    const runningBest = new Map<string, number>();
    const fastest = new Map<string, CompetitionResult>();
    const flagUpdates: { result_id: string; is_pb: boolean }[] = [];

    for (const result of eligible) {
      const key = `${result.distance}|${result.stroke}|${this.effectiveCourse(result)}`;
      const time = Number(result.time);
      const best = runningBest.get(key);
      const isPb = best === undefined || time < best;
      if (isPb) runningBest.set(key, time);
      if (result.is_pb !== isPb) {
        flagUpdates.push({ result_id: result.result_id, is_pb: isPb });
      }
      const currentFastest = fastest.get(key);
      if (!currentFastest || time < Number(currentFastest.time)) {
        fastest.set(key, result);
      }
    }
    // Ineligible results (DQs, relays) must never carry a stale PB flag.
    for (const result of results) {
      if ((result.dq || result.is_relay || Number(result.time) <= 0) && result.is_pb) {
        flagUpdates.push({ result_id: result.result_id, is_pb: false });
      }
    }

    for (const update of flagUpdates) {
      await this.resultRepo.update({ result_id: update.result_id }, { is_pb: update.is_pb });
    }

    // Sync the personal_bests table to the fastest time per key.
    const existing = await this.scoped.scopedFind(this.pbRepo, {
      where: { member_id: memberId },
    });
    const existingByKey = new Map(
      existing.map((pb) => [`${pb.distance}|${pb.stroke}|${pb.course}`, pb]),
    );

    let improved = 0;
    for (const [key, result] of fastest) {
      const [, , course] = key.split('|');
      const time = Number(result.time);
      const achievedAt = this.effectiveSwumAt(result);
      const current = existingByKey.get(key);
      existingByKey.delete(key);
      if (current) {
        if (Number(current.time) !== time || current.result_id !== result.result_id) {
          if (time < Number(current.time)) improved++;
          await this.pbRepo.update(
            { pb_id: current.pb_id },
            { time, result_id: result.result_id, achieved_at: achievedAt },
          );
        }
      } else {
        improved++;
        await this.pbRepo.save(
          this.pbRepo.create({
            club_id: clubId,
            member_id: memberId,
            distance: result.distance,
            stroke: result.stroke,
            course: course as CourseType,
            time,
            result_id: result.result_id,
            achieved_at: achievedAt,
          }),
        );
      }
    }

    // Any remaining stored PBs have no backing results left; remove them.
    const stale = Array.from(existingByKey.values()).map((pb) => pb.pb_id);
    if (stale.length > 0) {
      await this.pbRepo.delete({ pb_id: In(stale), club_id: clubId });
    }

    return { improved };
  }

  private async eligibleResultsForMember(memberId: string): Promise<CompetitionResult[]> {
    const results = await this.scoped.scopedFind(this.resultRepo, {
      where: { member_id: memberId },
      relations: ['competition'],
    });
    return results.filter((r) => !r.dq && !r.is_relay && Number(r.time) > 0);
  }

  /** Results imported before course stamping fall back to the meet's course. */
  private effectiveCourse(result: CompetitionResult): CourseType {
    return result.course ?? result.competition?.course ?? CourseType.SC;
  }

  /** The date the time was swum: its own swum_at, else the meet's start date. */
  private effectiveSwumAt(result: CompetitionResult): Date | null {
    return result.swum_at ?? result.competition?.start_date ?? null;
  }

  /** The British Swimming season runs 1 September to 31 August. */
  static currentSeasonStart(now: Date = new Date()): Date {
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(Date.UTC(year, 8, 1));
  }
}
