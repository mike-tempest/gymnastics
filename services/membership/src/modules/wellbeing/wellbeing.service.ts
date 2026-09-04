import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WellbeingRepository } from './wellbeing.repository';
import { CreateWellbeingLogDto } from './dto/create-wellbeing-log.dto';
import { CreateCycleLogDto } from './dto/create-cycle-log.dto';
import { UpdateCycleLogDto } from './dto/update-cycle-log.dto';
import { ReadinessLevel, WellbeingLog } from './entities/wellbeing-log.entity';
import { CycleLog } from './entities/cycle-log.entity';

export interface SwimmerReadiness {
  swimmer_id: string;
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
  swimmers: SwimmerReadiness[];
}

@Injectable()
export class WellbeingService {
  private readonly logger = new Logger(WellbeingService.name);

  constructor(private readonly wellbeingRepository: WellbeingRepository) {}

  // --- Parent-facing: wellbeing check-ins ---

  async submitCheckIn(dto: CreateWellbeingLogDto): Promise<WellbeingLog> {
    return this.wellbeingRepository.upsertWellbeingLog(dto);
  }

  async getSwimmerHistory(swimmerId: string, limit = 30): Promise<WellbeingLog[]> {
    return this.wellbeingRepository.findWellbeingBySwimmer(swimmerId, limit);
  }

  async getTodayCheckIn(swimmerId: string): Promise<WellbeingLog | null> {
    return this.wellbeingRepository.findTodayWellbeing(swimmerId);
  }

  // --- Parent-facing: cycle tracking (consent-gated) ---

  async submitCycleLog(dto: CreateCycleLogDto): Promise<CycleLog> {
    return this.wellbeingRepository.createCycleLog(dto);
  }

  async getCycleHistory(swimmerId: string, limit = 12): Promise<CycleLog[]> {
    return this.wellbeingRepository.findCycleLogsBySwimmer(swimmerId, limit);
  }

  async updateCycleLog(
    logId: string,
    swimmerId: string,
    dto: UpdateCycleLogDto,
  ): Promise<CycleLog> {
    const existing = await this.wellbeingRepository.findOneCycleLog(logId);
    if (!existing) {
      throw new NotFoundException('Cycle log not found');
    }
    if (existing.swimmer_id !== swimmerId) {
      throw new ForbiddenException("Cannot update another swimmer's cycle log");
    }
    const updated = await this.wellbeingRepository.updateCycleLog(logId, dto);
    return updated!;
  }

  async removeCycleLog(logId: string, swimmerId: string): Promise<void> {
    const existing = await this.wellbeingRepository.findOneCycleLog(logId);
    if (!existing) {
      throw new NotFoundException('Cycle log not found');
    }
    if (existing.swimmer_id !== swimmerId) {
      throw new ForbiddenException("Cannot delete another swimmer's cycle log");
    }
    await this.wellbeingRepository.removeCycleLog(logId);
  }

  // --- Coach-facing: readiness only (no raw data) ---

  async getSessionReadiness(swimmerIds: string[], date: string): Promise<SessionReadinessSummary> {
    const logs = await this.wellbeingRepository.findWellbeingByDate(swimmerIds, date);

    const logMap = new Map<string, WellbeingLog>();
    for (const log of logs) {
      logMap.set(log.swimmer_id, log);
    }

    const swimmers: SwimmerReadiness[] = [];
    let green = 0;
    let amber = 0;
    let red = 0;
    let noData = 0;

    for (const id of swimmerIds) {
      const log = logMap.get(id);
      if (!log) {
        noData++;
        continue;
      }

      const readiness = log.readiness;
      if (readiness === ReadinessLevel.GREEN) green++;
      else if (readiness === ReadinessLevel.AMBER) amber++;
      else red++;

      swimmers.push({
        swimmer_id: id,
        first_name: log.swimmer?.first_name ?? '',
        last_name: log.swimmer?.last_name ?? '',
        readiness,
        prefers_land_training: log.prefers_land_training,
      });
    }

    return {
      total: swimmerIds.length,
      green,
      amber,
      red,
      no_data: noData,
      swimmers,
    };
  }
}
