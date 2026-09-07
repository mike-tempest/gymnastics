import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AwardScheme } from './entities/award-scheme.entity';
import { AwardLevel } from './entities/award-level.entity';
import { MemberAwardProgress } from './entities/member-award-progress.entity';
import { AssessmentEvent, AssessmentOutcome } from './entities/assessment-event.entity';
import { CreateAwardSchemeDto, UpdateAwardSchemeDto } from './dto/award-scheme.dto';
import { CreateAwardLevelDto, UpdateAwardLevelDto } from './dto/award-level.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Every read here goes through TenantScopedHelper and every write is either
 * stamped with the active club or predicated on it, so an id belonging to
 * another club behaves as not-found rather than leaking or mutating a row.
 */
@Injectable()
export class AwardsRepository {
  constructor(
    @InjectRepository(AwardScheme)
    private readonly schemeRepo: Repository<AwardScheme>,
    @InjectRepository(AwardLevel)
    private readonly levelRepo: Repository<AwardLevel>,
    @InjectRepository(MemberAwardProgress)
    private readonly progressRepo: Repository<MemberAwardProgress>,
    @InjectRepository(AssessmentEvent)
    private readonly eventRepo: Repository<AssessmentEvent>,
    @InjectRepository(AssessmentOutcome)
    private readonly outcomeRepo: Repository<AssessmentOutcome>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  // --- Schemes ---

  async findAllSchemes(includeInactive = false): Promise<AwardScheme[]> {
    return await this.scoped.scopedFind(this.schemeRepo, {
      where: includeInactive ? {} : { active: true },
      order: { name: 'ASC' },
    });
  }

  async findOneScheme(schemeId: string): Promise<AwardScheme | null> {
    return await this.scoped.scopedFindOne(this.schemeRepo, {
      where: { scheme_id: schemeId },
    });
  }

  async findSchemeByName(name: string): Promise<AwardScheme | null> {
    return await this.scoped.scopedFindOne(this.schemeRepo, { where: { name } });
  }

  async createScheme(dto: CreateAwardSchemeDto): Promise<AwardScheme> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = dto as CreateAwardSchemeDto & { club_id?: string };
    const scheme = this.schemeRepo.create(this.scoped.stampCreate<AwardScheme>(rest));
    return await this.schemeRepo.save(scheme);
  }

  async updateScheme(schemeId: string, dto: UpdateAwardSchemeDto): Promise<AwardScheme | null> {
    // Scope the affected-row predicate by club_id and never allow club_id to be
    // reassigned via the DTO.
    const { club_id: _ignored, ...rest } = dto as UpdateAwardSchemeDto & { club_id?: string };
    await this.schemeRepo.update(
      { scheme_id: schemeId, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findOneScheme(schemeId);
  }

  async removeScheme(schemeId: string): Promise<void> {
    await this.schemeRepo.delete({
      scheme_id: schemeId,
      club_id: this.tenantContext.getClubId(),
    });
  }

  // --- Levels ---

  async findLevelsByScheme(schemeId: string): Promise<AwardLevel[]> {
    return await this.scoped.scopedFind(this.levelRepo, {
      where: { scheme_id: schemeId },
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async findAllLevels(): Promise<AwardLevel[]> {
    return await this.scoped.scopedFind(this.levelRepo, {
      order: { sort_order: 'ASC', name: 'ASC' },
    });
  }

  async findOneLevel(levelId: string): Promise<AwardLevel | null> {
    return await this.scoped.scopedFindOne(this.levelRepo, {
      where: { level_id: levelId },
      relations: ['scheme'],
    });
  }

  async createLevel(dto: CreateAwardLevelDto): Promise<AwardLevel> {
    const { club_id: _ignored, ...rest } = dto as CreateAwardLevelDto & { club_id?: string };
    const level = this.levelRepo.create(this.scoped.stampCreate<AwardLevel>(rest));
    return await this.levelRepo.save(level);
  }

  async updateLevel(levelId: string, dto: UpdateAwardLevelDto): Promise<AwardLevel | null> {
    const { club_id: _ignored, ...rest } = dto as UpdateAwardLevelDto & { club_id?: string };
    await this.levelRepo.update(
      { level_id: levelId, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findOneLevel(levelId);
  }

  async removeLevel(levelId: string): Promise<void> {
    await this.levelRepo.delete({
      level_id: levelId,
      club_id: this.tenantContext.getClubId(),
    });
  }

  // --- Member progress ---

  async findProgressByMember(memberId: string): Promise<MemberAwardProgress[]> {
    return await this.scoped.scopedFind(this.progressRepo, {
      where: { member_id: memberId },
      relations: ['level', 'level.scheme'],
      order: { updated_at: 'DESC' },
    });
  }

  async findProgressByMembers(memberIds: string[]): Promise<MemberAwardProgress[]> {
    if (memberIds.length === 0) return [];
    return await this.scoped.scopedFind(this.progressRepo, {
      where: { member_id: In(memberIds) },
      relations: ['level', 'level.scheme'],
    });
  }

  async findProgressByLevel(levelId: string): Promise<MemberAwardProgress[]> {
    return await this.scoped.scopedFind(this.progressRepo, {
      where: { level_id: levelId },
      relations: ['member'],
    });
  }

  async findOneProgress(memberId: string, levelId: string): Promise<MemberAwardProgress | null> {
    return await this.scoped.scopedFindOne(this.progressRepo, {
      where: { member_id: memberId, level_id: levelId },
    });
  }

  /**
   * Upserts the single (member, level) progress row. The existence check is
   * club-scoped, so a row belonging to another club reads as not-found and a
   * fresh, correctly stamped row is created instead of mutating theirs.
   */
  async upsertProgress(
    memberId: string,
    levelId: string,
    fields: Partial<MemberAwardProgress>,
  ): Promise<MemberAwardProgress> {
    const existing = await this.findOneProgress(memberId, levelId);
    if (existing) {
      const { club_id: _ignored, ...rest } = fields;
      await this.progressRepo.update(
        { progress_id: existing.progress_id, club_id: this.tenantContext.getClubId() },
        rest,
      );
      return (await this.scoped.scopedFindOne(this.progressRepo, {
        where: { progress_id: existing.progress_id },
      }))!;
    }

    const { club_id: _dropped, ...rest } = fields;
    const row = this.progressRepo.create(
      this.scoped.stampCreate<MemberAwardProgress>({
        ...rest,
        member_id: memberId,
        level_id: levelId,
      }),
    );
    return await this.progressRepo.save(row);
  }

  // --- Assessment events and outcomes ---

  async createEvent(fields: Partial<AssessmentEvent>): Promise<AssessmentEvent> {
    const { club_id: _ignored, ...rest } = fields;
    const event = this.eventRepo.create(this.scoped.stampCreate<AssessmentEvent>(rest));
    return await this.eventRepo.save(event);
  }

  async createOutcome(fields: Partial<AssessmentOutcome>): Promise<AssessmentOutcome> {
    const { club_id: _ignored, ...rest } = fields;
    const outcome = this.outcomeRepo.create(this.scoped.stampCreate<AssessmentOutcome>(rest));
    return await this.outcomeRepo.save(outcome);
  }

  async updateOutcomeInvoice(outcomeId: string, invoiceId: string): Promise<void> {
    await this.outcomeRepo.update(
      { outcome_id: outcomeId, club_id: this.tenantContext.getClubId() },
      { invoice_id: invoiceId },
    );
  }

  async findEvents(levelId?: string, limit = 50): Promise<AssessmentEvent[]> {
    return await this.scoped.scopedFind(this.eventRepo, {
      where: levelId ? { level_id: levelId } : {},
      relations: ['level', 'level.scheme'],
      order: { assessed_at: 'DESC' },
      take: limit,
    });
  }

  async findOneEvent(eventId: string): Promise<AssessmentEvent | null> {
    return await this.scoped.scopedFindOne(this.eventRepo, {
      where: { event_id: eventId },
      relations: ['level', 'level.scheme', 'outcomes', 'outcomes.member'],
    });
  }
}
