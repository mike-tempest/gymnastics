import { Injectable, NotFoundException } from '@nestjs/common';
import { FeeStructuresRepository } from './fee-structures.repository';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { BulkFeeStructureItemDto } from './dto/bulk-create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { FeeStructure, AppliesToType } from './entities/fee-structure.entity';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { SquadsRepository } from '../../squads/squads.repository';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class FeeStructuresService {
  constructor(
    private readonly feeStructuresRepository: FeeStructuresRepository,
    private readonly clubsRepository: ClubsRepository,
    private readonly squadsRepository: SquadsRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createFeeStructureDto: CreateFeeStructureDto): Promise<FeeStructure> {
    // Stamp the fee with the owning club's billing currency. Falls back to GBP,
    // so a club with the default currency (every existing UK club) is unaffected.
    const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
    const currency = club?.currency ?? 'GBP';
    return await this.feeStructuresRepository.create(createFeeStructureDto, currency);
  }

  /**
   * Bulk create fee structures with validation per row.
   * Squad-scoped rows are resolved by squad name (case-insensitive) against the
   * active club's squads. Each row is processed individually so one bad row
   * never aborts the batch; failures are collected as 1-based row errors.
   */
  async bulkCreate(items: BulkFeeStructureItemDto[]): Promise<{
    created: FeeStructure[];
    errors: Array<{ row: number; message: string }>;
  }> {
    const created: FeeStructure[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Resolve the club currency once for the whole batch rather than per row.
    const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
    const currency = club?.currency ?? 'GBP';

    // Resolve squad names once per batch. The repository scopes the lookup to
    // the active tenant, so names can never resolve to another club's squads.
    let squadIdsByName: Map<string, string> | null = null;
    if (items.some((item) => item.applies_to_type === AppliesToType.SQUAD)) {
      const squads = await this.squadsRepository.findAllNames();
      squadIdsByName = new Map(
        squads.map((squad) => [squad.squad_name.trim().toLowerCase(), squad.squad_id]),
      );
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = i + 1;

      if (typeof item.amount !== 'number' || Number.isNaN(item.amount) || item.amount < 0) {
        errors.push({ row, message: 'Amount must be a non-negative number' });
        continue;
      }

      // For club-level fees applies_to_id stays null and any squad_name is ignored.
      let appliesToId: string | undefined;
      if (item.applies_to_type === AppliesToType.SQUAD) {
        const squadName = item.squad_name?.trim();
        if (!squadName) {
          errors.push({ row, message: 'squad_name is required when applies_to_type is squad' });
          continue;
        }
        appliesToId = squadIdsByName?.get(squadName.toLowerCase());
        if (!appliesToId) {
          errors.push({ row, message: `Squad "${squadName}" not found` });
          continue;
        }
      }

      try {
        const feeStructure = await this.feeStructuresRepository.create(
          {
            name: item.name,
            description: item.description,
            amount: item.amount,
            frequency: item.frequency,
            applies_to_type: item.applies_to_type,
            applies_to_id: appliesToId,
          },
          currency,
        );
        created.push(feeStructure);
      } catch (error: unknown) {
        errors.push({
          row,
          message: error instanceof Error ? error.message : 'Failed to create fee structure',
        });
      }
    }

    return { created, errors };
  }

  async findAll(): Promise<FeeStructure[]> {
    return await this.feeStructuresRepository.findAll();
  }

  async findActive(): Promise<FeeStructure[]> {
    return await this.feeStructuresRepository.findActive();
  }

  async findByType(appliesToType: AppliesToType): Promise<FeeStructure[]> {
    return await this.feeStructuresRepository.findByType(appliesToType);
  }

  async findOne(id: string): Promise<FeeStructure> {
    const feeStructure = await this.feeStructuresRepository.findOne(id);
    if (!feeStructure) {
      throw new NotFoundException(`Fee structure with ID ${id} not found`);
    }
    return feeStructure;
  }

  async update(id: string, updateFeeStructureDto: UpdateFeeStructureDto): Promise<FeeStructure> {
    await this.findOne(id); // This will throw if not found
    const updated = await this.feeStructuresRepository.update(id, updateFeeStructureDto);
    if (!updated) {
      throw new NotFoundException(`Fee structure with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.feeStructuresRepository.remove(id);
  }
}
