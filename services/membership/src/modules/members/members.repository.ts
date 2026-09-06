import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from './entities/member.entity';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

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

  async findAll(): Promise<Member[]> {
    return await this.scoped.scopedFind(this.repository, {
      order: {
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

  async findByFamilyId(familyId: string): Promise<Member[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { family_id: familyId },
      order: {
        dob: 'ASC',
      },
    });
  }

  /**
   * Returns members for the active tenant. The clubId argument is ignored: the
   * tenant context is the only source of truth (a caller cannot read another
   * club by passing its id). Kept for backwards-compatible call sites.
   */
  async findByClubId(_clubId?: string): Promise<Member[]> {
    return await this.scoped.scopedFind(this.repository, {
      order: {
        last_name: 'ASC',
        first_name: 'ASC',
      },
    });
  }

  async findBySquadId(squadId: string): Promise<Member[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { squad_id: squadId },
      order: {
        last_name: 'ASC',
        first_name: 'ASC',
      },
    });
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
