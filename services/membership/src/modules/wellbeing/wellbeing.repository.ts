import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WellbeingLog } from './entities/wellbeing-log.entity';
import { CycleLog } from './entities/cycle-log.entity';
import { CreateWellbeingLogDto } from './dto/create-wellbeing-log.dto';
import { CreateCycleLogDto } from './dto/create-cycle-log.dto';
import { UpdateCycleLogDto } from './dto/update-cycle-log.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class WellbeingRepository {
  constructor(
    @InjectRepository(WellbeingLog)
    private readonly wellbeingRepo: Repository<WellbeingLog>,
    @InjectRepository(CycleLog)
    private readonly cycleRepo: Repository<CycleLog>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  // --- Wellbeing logs ---

  async createWellbeingLog(dto: CreateWellbeingLogDto): Promise<WellbeingLog> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = dto as CreateWellbeingLogDto & {
      club_id?: string;
    };
    const log = this.wellbeingRepo.create(this.scoped.stampCreate<WellbeingLog>(rest));
    return await this.wellbeingRepo.save(log);
  }

  async upsertWellbeingLog(dto: CreateWellbeingLogDto): Promise<WellbeingLog> {
    // A wellbeing log is a child of a swimmer. The lookup is scoped so a row
    // belonging to another club resolves as not-found and we create afresh.
    const existing = await this.scoped.scopedFindOne(this.wellbeingRepo, {
      where: {
        swimmer_id: dto.swimmer_id,
        log_date: dto.log_date as unknown as Date,
      },
    });
    if (existing) {
      const { club_id: _ignored, ...rest } = dto as CreateWellbeingLogDto & {
        club_id?: string;
      };
      // Scope the affected-row predicate by club_id so a guessed id from
      // another club cannot be mutated.
      await this.wellbeingRepo.update(
        { log_id: existing.log_id, club_id: this.tenantContext.getClubId() },
        rest,
      );
      return (await this.scoped.scopedFindOne(this.wellbeingRepo, {
        where: { log_id: existing.log_id },
      }))!;
    }
    return this.createWellbeingLog(dto);
  }

  async findWellbeingBySwimmer(swimmerId: string, limit = 30): Promise<WellbeingLog[]> {
    return await this.scoped.scopedFind(this.wellbeingRepo, {
      where: { swimmer_id: swimmerId },
      order: { log_date: 'DESC' },
      take: limit,
    });
  }

  async findWellbeingByDate(swimmerIds: string[], date: string): Promise<WellbeingLog[]> {
    if (swimmerIds.length === 0) return [];
    return await this.scoped.scopedFind(this.wellbeingRepo, {
      where: {
        swimmer_id: In(swimmerIds),
        log_date: date as unknown as Date,
      },
      relations: ['swimmer'],
    });
  }

  async findTodayWellbeing(swimmerId: string): Promise<WellbeingLog | null> {
    const today = new Date().toISOString().split('T')[0];
    return await this.scoped.scopedFindOne(this.wellbeingRepo, {
      where: { swimmer_id: swimmerId, log_date: today as unknown as Date },
    });
  }

  // --- Cycle logs ---

  async createCycleLog(dto: CreateCycleLogDto): Promise<CycleLog> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = dto as CreateCycleLogDto & {
      club_id?: string;
    };
    const log = this.cycleRepo.create(this.scoped.stampCreate<CycleLog>(rest));
    return await this.cycleRepo.save(log);
  }

  async findCycleLogsBySwimmer(swimmerId: string, limit = 12): Promise<CycleLog[]> {
    return await this.scoped.scopedFind(this.cycleRepo, {
      where: { swimmer_id: swimmerId },
      order: { period_start: 'DESC' },
      take: limit,
    });
  }

  async findOneCycleLog(logId: string): Promise<CycleLog | null> {
    // A log_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.cycleRepo, {
      where: { log_id: logId },
    });
  }

  async updateCycleLog(logId: string, dto: UpdateCycleLogDto): Promise<CycleLog | null> {
    // Scope the affected-row predicate by club_id and never allow club_id to be
    // reassigned via the DTO.
    const { club_id: _ignored, ...rest } = dto as UpdateCycleLogDto & {
      club_id?: string;
    };
    await this.cycleRepo.update({ log_id: logId, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOneCycleLog(logId);
  }

  async removeCycleLog(logId: string): Promise<void> {
    await this.cycleRepo.delete({
      log_id: logId,
      club_id: this.tenantContext.getClubId(),
    });
  }
}
