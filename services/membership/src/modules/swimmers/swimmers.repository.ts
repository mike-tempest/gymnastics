import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Swimmer } from './entities/swimmer.entity';
import { CreateSwimmerDto } from './dto/create-swimmer.dto';
import { UpdateSwimmerDto } from './dto/update-swimmer.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class SwimmersRepository {
  constructor(
    @InjectRepository(Swimmer)
    private readonly repository: Repository<Swimmer>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createSwimmerDto: CreateSwimmerDto): Promise<Swimmer> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createSwimmerDto;
    const swimmer = this.repository.create(this.scoped.stampCreate<Swimmer>(rest));
    return await this.repository.save(swimmer);
  }

  async findAll(): Promise<Swimmer[]> {
    return await this.scoped.scopedFind(this.repository, {
      order: {
        last_name: 'ASC',
        first_name: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<Swimmer | null> {
    // A swimmer_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { swimmer_id: id },
    });
  }

  async findByFamilyId(familyId: string): Promise<Swimmer[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { family_id: familyId },
      order: {
        dob: 'ASC',
      },
    });
  }

  /**
   * Returns swimmers for the active tenant. The clubId argument is ignored: the
   * tenant context is the only source of truth (a caller cannot read another
   * club by passing its id). Kept for backwards-compatible call sites.
   */
  async findByClubId(_clubId?: string): Promise<Swimmer[]> {
    return await this.scoped.scopedFind(this.repository, {
      order: {
        last_name: 'ASC',
        first_name: 'ASC',
      },
    });
  }

  async findBySquadId(squadId: string): Promise<Swimmer[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { squad_id: squadId },
      order: {
        last_name: 'ASC',
        first_name: 'ASC',
      },
    });
  }

  async update(id: string, updateSwimmerDto: UpdateSwimmerDto): Promise<Swimmer | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateSwimmerDto as UpdateSwimmerDto & {
      club_id?: string;
    };
    await this.repository.update({ swimmer_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      swimmer_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }
}
