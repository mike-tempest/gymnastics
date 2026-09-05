import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WellbeingRepository } from './wellbeing.repository';
import { CreateWellbeingLogDto } from './dto/create-wellbeing-log.dto';
import { CreateCycleLogDto } from './dto/create-cycle-log.dto';
import { UpdateCycleLogDto } from './dto/update-cycle-log.dto';
import { ReadinessLevel, WellbeingLog } from './entities/wellbeing-log.entity';
import { CycleLog } from './entities/cycle-log.entity';

export interface MemberReadiness {
  member_id: string;
  first_name: string;
  last_name: string;
  readiness: ReadinessLevel;
  prefers_land_training: boolean;
}

export interface SessionReadinessSummary {
  total: number;
  green: number;
  amber: number;
  red: number;
  no_data: number;
  members: MemberReadiness[];
}

@Injectable()
export class WellbeingService {
  private readonly logger = new Logger(WellbeingService.name);

  constructor(private readonly wellbeingRepository: WellbeingRepository) {}

  // --- Parent-facing: wellbeing check-ins ---

  async submitCheckIn(dto: CreateWellbeingLogDto): Promise<WellbeingLog> {
    return this.wellbeingRepository.upsertWellbeingLog(dto);
  }

  async getMemberHistory(memberId: string, limit = 30): Promise<WellbeingLog[]> {
    return this.wellbeingRepository.findWellbeingByMember(memberId, limit);
  }

  async getTodayCheckIn(memberId: string): Promise<WellbeingLog | null> {
    return this.wellbeingRepository.findTodayWellbeing(memberId);
  }

  // --- Parent-facing: cycle tracking (consent-gated) ---

  async submitCycleLog(dto: CreateCycleLogDto): Promise<CycleLog> {
    return this.wellbeingRepository.createCycleLog(dto);
  }

  async getCycleHistory(memberId: string, limit = 12): Promise<CycleLog[]> {
    return this.wellbeingRepository.findCycleLogsByMember(memberId, limit);
  }

  async updateCycleLog(
    logId: string,
    memberId: string,
    dto: UpdateCycleLogDto,
  ): Promise<CycleLog> {
    const existing = await this.wellbeingRepository.findOneCycleLog(logId);
    if (!existing) {
      throw new NotFoundException('Cycle log not found');
    }
    if (existing.member_id !== memberId) {
      throw new ForbiddenException("Cannot update another member's cycle log");
    }
    const updated = await this.wellbeingRepository.updateCycleLog(logId, dto);
    return updated!;
  }

  async removeCycleLog(logId: string, memberId: string): Promise<void> {
    const existing = await this.wellbeingRepository.findOneCycleLog(logId);
    if (!existing) {
      throw new NotFoundException('Cycle log not found');
    }
    if (existing.member_id !== memberId) {
      throw new ForbiddenException("Cannot delete another member's cycle log");
    }
    await this.wellbeingRepository.removeCycleLog(logId);
  }

  // --- Coach-facing: readiness only (no raw data) ---

  async getSessionReadiness(memberIds: string[], date: string): Promise<SessionReadinessSummary> {
    const logs = await this.wellbeingRepository.findWellbeingByDate(memberIds, date);

    const logMap = new Map<string, WellbeingLog>();
    for (const log of logs) {
      logMap.set(log.member_id, log);
    }

    const members: MemberReadiness[] = [];
    let green = 0;
    let amber = 0;
    let red = 0;
    let noData = 0;

    for (const id of memberIds) {
      const log = logMap.get(id);
      if (!log) {
        noData++;
        continue;
      }

      const readiness = log.readiness;
      if (readiness === ReadinessLevel.GREEN) green++;
      else if (readiness === ReadinessLevel.AMBER) amber++;
      else red++;

      members.push({
        member_id: id,
        first_name: log.member?.first_name ?? '',
        last_name: log.member?.last_name ?? '',
        readiness,
        prefers_land_training: log.prefers_land_training,
      });
    }

    return {
      total: memberIds.length,
      green,
      amber,
      red,
      no_data: noData,
      members,
    };
  }
}
