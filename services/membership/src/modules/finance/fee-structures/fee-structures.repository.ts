import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeeStructure, AppliesToType } from './entities/fee-structure.entity';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class FeeStructuresRepository {
  constructor(
    @InjectRepository(FeeStructure)
    private readonly repository: Repository<FeeStructure>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(
    createFeeStructureDto: CreateFeeStructureDto,
    currency?: string,
  ): Promise<FeeStructure> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createFeeStructureDto as CreateFeeStructureDto & {
      club_id?: string;
    };
    const feeStructure = this.repository.create(
      this.scoped.stampCreate<FeeStructure>({
        ...rest,
        // Currency is set from the owning club by the service. When omitted the
        // entity default (GBP) applies, preserving prior behaviour.
        ...(currency ? { currency } : {}),
      }),
    );
    return await this.repository.save(feeStructure);
  }

  async findAll(): Promise<FeeStructure[]> {
    return await this.scoped.scopedFind(this.repository, {
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findActive(): Promise<FeeStructure[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { active: true },
      order: {
        name: 'ASC',
      },
    });
  }

  async findByType(appliesToType: AppliesToType): Promise<FeeStructure[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: {
        applies_to_type: appliesToType,
        active: true,
      },
      order: {
        name: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<FeeStructure | null> {
    // A fee_structure_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { fee_structure_id: id },
    });
  }

  async update(
    id: string,
    updateFeeStructureDto: UpdateFeeStructureDto,
  ): Promise<FeeStructure | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateFeeStructureDto as UpdateFeeStructureDto & {
      club_id?: string;
    };
    await this.repository.update(
      { fee_structure_id: id, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      fee_structure_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }
}
