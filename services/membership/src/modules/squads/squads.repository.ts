import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Discipline, SquadType } from '@club-manager/shared-types';
import { Squad } from './entities/squad.entity';
import { Member } from '../members/entities/member.entity';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Optional narrowing applied to a squad listing. A club runs its recreational
 * classes and its competitive squads out of the same table, so type is the
 * filter that separates the two, and discipline narrows within either.
 */
export interface SquadFilters {
  type?: SquadType;
  discipline?: Discipline;
}

/**
 * Turn the supplied filters into a single TypeORM `where`. Unset filters are
 * left out entirely: including a key with an undefined value would make
 * TypeORM match on NULL rather than skip the column.
 */
function buildSquadWhere(filters: SquadFilters): FindOptionsWhere<Squad> {
  const where: FindOptionsWhere<Squad> = {};

  if (filters.type) {
    where.squad_type = filters.type;
  }
  if (filters.discipline) {
    where.discipline = filters.discipline;
  }

  return where;
}

@Injectable()
export class SquadsRepository {
  constructor(
    @InjectRepository(Squad)
    private readonly repository: Repository<Squad>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
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

  /**
   * Returns squads for the active tenant, narrowed by any supplied filters.
   *
   * The filters are composed into one `where` object that `scoped.scopedFind`
   * then adds club scoping to, so they can only narrow the result set and
   * never reach outside the active club.
   */
  async findAll(filters: SquadFilters = {}): Promise<Squad[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: buildSquadWhere(filters),
      relations: ['members'],
      order: {
        squad_name: 'ASC',
      },
    });
  }

  async findAllNames(): Promise<Array<Pick<Squad, 'squad_id' | 'squad_name'>>> {
    // Lightweight tenant-scoped lookup for name resolution and duplicate-name
    // checks; avoids loading the members relation that findAll() eager-loads.
    return await this.scoped.scopedFind(this.repository, {
      select: ['squad_id', 'squad_name'],
      order: {
        squad_name: 'ASC',
      },
    });
  }

  /**
   * Squad type and discipline for every squad in the active club, for the
   * statistics roll-up. Deliberately skips the members relation that findAll()
   * loads, since the counts do not need it.
   *
   * squad_id is selected even though the caller never reads it: TypeORM groups
   * raw rows by the primary key when building entities, so leaving it out of an
   * explicit `select` folds every squad into a single result and the counts
   * come back as 1. findAllNames() above selects it for the same reason.
   */
  async findAllClassifications(): Promise<
    Array<Pick<Squad, 'squad_id' | 'squad_type' | 'discipline'>>
  > {
    return await this.scoped.scopedFind(this.repository, {
      select: ['squad_id', 'squad_type', 'discipline'],
    });
  }

  async findOne(id: string): Promise<Squad | null> {
    // A squad_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: id },
      relations: ['members'],
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

  async assignMember(squadId: string, memberId: string): Promise<Squad | null> {
    const squad = await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: squadId },
      relations: ['members'],
    });

    if (!squad) {
      return null;
    }

    // Only allow assigning a member that belongs to the same tenant.
    const member = await this.scoped.scopedFindOne(this.memberRepository, {
      where: { member_id: memberId },
    });

    if (!member) {
      return null;
    }

    // Check if member is already in squad
    const isAlreadyInSquad = squad.members.some((s) => s.member_id === memberId);

    if (!isAlreadyInSquad) {
      squad.members.push(member);
      await this.repository.save(squad);
    }

    return this.findOne(squadId);
  }

  async removeMember(squadId: string, memberId: string): Promise<Squad | null> {
    const squad = await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: squadId },
      relations: ['members'],
    });

    if (!squad) {
      return null;
    }

    squad.members = squad.members.filter((member) => member.member_id !== memberId);

    await this.repository.save(squad);
    return this.findOne(squadId);
  }

  async getMembersBySquad(squadId: string): Promise<Member[]> {
    const squad = await this.scoped.scopedFindOne(this.repository, {
      where: { squad_id: squadId },
      relations: ['members'],
    });

    return squad ? squad.members : [];
  }
}
