import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Squad } from './entities/squad.entity';
import { Swimmer } from '../swimmers/entities/swimmer.entity';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class SquadsRepository {
  constructor(
    @InjectRepository(Squad)
    private readonly repository: Repository<Squad>,
    @InjectRepository(Swimmer)
    private readonly swimmerRepository: Repository<Swimmer>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createSquadDto: CreateSquadDto): Promise<Squad> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createSquadDto as CreateSquadDto & {
      club_id?: string;
    };
    const squad = this.repository.create(this.scoped.stampCreate<Squad>(rest));
    return await this.repository.save(squad);
  }

  async findAll(): Promise<Squad[]> {
    return await this.scoped.scopedFind(this.repository, {
      relations: ['swimmers'],
      order: {
        squad_name: 'ASC',
      },
    });
  }

  async findAllNames(): Promise<Array<Pick<Squad, 'squad_id' | 'squad_name'>>> {
    // Lightweight tenant-scoped lookup for name resolution and duplicate-name
    // checks; avoids loading the swimmers relation that findAll() eager-loads.
    return await this.scoped.scopedFind(this.repository, {
      select: ['squad_id', 'squad_name'],
      order: {
        squad_name: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<Squad | null> {
    // A squad_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: id },
      relations: ['swimmers'],
    });
  }

  async update(id: string, updateSquadDto: UpdateSquadDto): Promise<Squad | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateSquadDto as UpdateSquadDto & {
      club_id?: string;
    };
    await this.repository.update({ squad_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      squad_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async assignSwimmer(squadId: string, swimmerId: string): Promise<Squad | null> {
    const squad = await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: squadId },
      relations: ['swimmers'],
    });

    if (!squad) {
      return null;
    }

    // Only allow assigning a swimmer that belongs to the same tenant.
    const swimmer = await this.scoped.scopedFindOne(this.swimmerRepository, {
      where: { swimmer_id: swimmerId },
    });

    if (!swimmer) {
      return null;
    }

    // Check if swimmer is already in squad
    const isAlreadyInSquad = squad.swimmers.some((s) => s.swimmer_id === swimmerId);

    if (!isAlreadyInSquad) {
      squad.swimmers.push(swimmer);
      await this.repository.save(squad);
    }

    return this.findOne(squadId);
  }

  async removeSwimmer(squadId: string, swimmerId: string): Promise<Squad | null> {
    const squad = await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: squadId },
      relations: ['swimmers'],
    });

    if (!squad) {
      return null;
    }

    squad.swimmers = squad.swimmers.filter((swimmer) => swimmer.swimmer_id !== swimmerId);

    await this.repository.save(squad);
    return this.findOne(squadId);
  }

  async getSwimmersBySquad(squadId: string): Promise<Swimmer[]> {
    const squad = await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: squadId },
      relations: ['swimmers'],
    });

    return squad ? squad.swimmers : [];
  }
}
