import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Discipline } from '@club-manager/shared-types';
import { Member } from './entities/member.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/**
 * Optional narrowing applied to a member listing. Each filter is independent
 * and they compose: passing a squad and a discipline returns the members that
 * match both. None of them can reach outside the active club, which is added
 * afterwards by the tenant-scoped helper.
 */
export interface MemberFilters {
  familyId?: string;
  squadId?: string;
  discipline?: Discipline;
}

/**
 * Turn the supplied filters into a single TypeORM `where`. Unset filters are
 * left out entirely: including a key with an undefined value would make
 * TypeORM match on NULL rather than skip the column.
 */
function buildMemberWhere(filters: MemberFilters): FindOptionsWhere<Member> {
  const where: FindOptionsWhere<Member> = {};

  if (filters.familyId) {
    where.family_id = filters.familyId;
  }
  if (filters.squadId) {
    where.squad_id = filters.squadId;
  }
  if (filters.discipline) {
    where.discipline = filters.discipline;
  }

  return where;
}

@Injectable()
export class MembersRepository {
  constructor(
    @InjectRepository(Member)
    private readonly repository: Repository<Member>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createMemberDto: CreateMemberDto): Promise<Member> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createMemberDto;
    const member = this.repository.create(this.scoped.stampCreate<Member>(rest));
    return await this.repository.save(member);
  }

  /**
   * Returns members for the active tenant, narrowed by any supplied filters.
   *
   * Every filter is composed into one `where` object which is then handed to
   * `scoped.scopedFind`, so club scoping is applied last and on top of whatever
   * the caller asked for. Filters can only ever narrow the result set; none of
   * them can widen it past the active club. Omitted filters are dropped rather
   * than matched against undefined.
   *
   * Ordering follows the question being asked. A family listing is a list of
   * siblings, which reads naturally oldest first; every other listing is a
   * roll call and reads by name.
   */
  async findAll(filters: MemberFilters = {}): Promise<Member[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: buildMemberWhere(filters),
      order: filters.familyId
        ? { dob: 'ASC' }
        : {
            last_name: 'ASC',
            first_name: 'ASC',
          },
    });
  }

  async findOne(id: string): Promise<Member | null> {
    // A member_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { member_id: id },
    });
  }

  /** Siblings within one family, oldest first. */
  async findByFamilyId(familyId: string): Promise<Member[]> {
    return await this.findAll({ familyId });
  }

  /**
   * Returns members for the active tenant. The clubId argument is ignored: the
   * tenant context is the only source of truth (a caller cannot read another
   * club by passing its id). Kept for backwards-compatible call sites.
   */
  async findByClubId(_clubId?: string): Promise<Member[]> {
    return await this.findAll();
  }

  async findBySquadId(squadId: string): Promise<Member[]> {
    return await this.findAll({ squadId });
  }

  async update(id: string, updateMemberDto: UpdateMemberDto): Promise<Member | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateMemberDto as UpdateMemberDto & {
      club_id?: string;
    };
    await this.repository.update({ member_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      member_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }
}
