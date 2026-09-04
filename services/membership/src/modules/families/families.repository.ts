import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Family } from './entities/family.entity';
import { FamilyInvite } from './entities/family-invite.entity';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class FamiliesRepository {
  constructor(
    @InjectRepository(Family)
    private readonly repository: Repository<Family>,
    @InjectRepository(FamilyInvite)
    private readonly inviteRepository: Repository<FamilyInvite>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createFamilyDto: CreateFamilyDto): Promise<Family> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createFamilyDto as CreateFamilyDto & {
      club_id?: string;
    };
    const family = this.repository.create(this.scoped.stampCreate<Family>(rest));
    return await this.repository.save(family);
  }

  async findAll(): Promise<Family[]> {
    return await this.scoped.scopedFind(this.repository, {
      relations: ['swimmers'],
      order: {
        family_name: 'ASC',
      },
    });
  }

  async findOne(id: string): Promise<Family | null> {
    // A family_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { family_id: id },
      relations: ['swimmers'],
    });
  }

  /**
   * Case-insensitive lookup of a family by its primary contact email, scoped
   * to the active tenant. Used by the data-import module to match import rows
   * to existing families.
   */
  async findByPrimaryContactEmail(
    email: string,
  ): Promise<Pick<Family, 'family_id' | 'family_name' | 'primary_contact_email'> | null> {
    return await this.scoped
      .scopedQueryBuilder(this.repository, 'family')
      .select(['family.family_id', 'family.family_name', 'family.primary_contact_email'])
      .andWhere('LOWER(family.primary_contact_email) = LOWER(:email)', { email })
      .getOne();
  }

  /**
   * Unscoped lookup by id, for NON-REQUEST paths only (e.g. the GoCardless
   * webhook) that run without a tenant/CLS context. The caller has already
   * resolved the club from a loaded mandate/invoice row, so this is used purely
   * to fetch the family for an email. Do NOT use on request-handling routes.
   */
  async findOneUnscoped(id: string): Promise<Family | null> {
    return await this.repository.findOne({
      where: { family_id: id },
      relations: ['swimmers'],
    });
  }

  async update(id: string, updateFamilyDto: UpdateFamilyDto): Promise<Family | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateFamilyDto as UpdateFamilyDto & {
      club_id?: string;
    };
    await this.repository.update({ family_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      family_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  // Invite token methods

  async createInvite(familyId: string, token: string, expiresAt: Date): Promise<FamilyInvite> {
    // Invites are generated from an authenticated coach/admin route, so stamp the
    // invite with the active tenant's club_id. The familyId has already been
    // resolved through a scoped findOne, so it belongs to the same club.
    const invite = this.inviteRepository.create(
      this.scoped.stampCreate<FamilyInvite>({
        family_id: familyId,
        token,
        expires_at: expiresAt,
      }),
    );
    return await this.inviteRepository.save(invite);
  }

  /**
   * Resolve an invite by its secret token.
   *
   * IMPORTANT: this is reached from PUBLIC, unauthenticated routes
   * (POST families/invite/accept and GET families/invite/verify/:token), so there
   * is no tenant context available. We therefore deliberately do NOT scope by
   * getClubId() here. The token is a cryptographically random 64-char secret that
   * is unguessable, so the lookup is self-authorising and the club is derived from
   * the returned invite row (invite.club_id / invite.family) by the caller.
   */
  async findInviteByToken(token: string): Promise<FamilyInvite | null> {
    return await this.inviteRepository.findOne({
      where: { token, expires_at: MoreThan(new Date()) },
      relations: ['family'],
    });
  }

  /**
   * Remove an invite after it has been consumed.
   *
   * Also reachable from the PUBLIC accept route (no tenant context), so this is
   * scoped only by invite_id. The invite_id is a server-generated UUID that the
   * caller obtained by resolving the secret token in findInviteByToken, so there
   * is no cross-tenant guessing surface on this path.
   */
  async removeInvite(inviteId: string): Promise<void> {
    await this.inviteRepository.delete(inviteId);
  }
}
