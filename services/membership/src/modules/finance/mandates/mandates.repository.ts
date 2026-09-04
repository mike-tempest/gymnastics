import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DirectDebitMandate,
  DirectDebitMandateStatus,
} from './entities/direct-debit-mandate.entity';
import { CreateMandateDto } from './dto/create-mandate.dto';
import { UpdateMandateDto } from './dto/update-mandate.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class MandatesRepository {
  constructor(
    @InjectRepository(DirectDebitMandate)
    private readonly repository: Repository<DirectDebitMandate>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createMandateDto: CreateMandateDto): Promise<DirectDebitMandate> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createMandateDto as CreateMandateDto & {
      club_id?: string;
    };
    const mandate = this.repository.create(this.scoped.stampCreate<DirectDebitMandate>(rest));
    return await this.repository.save(mandate);
  }

  async findAll(): Promise<DirectDebitMandate[]> {
    return await this.scoped.scopedFind(this.repository, {
      relations: ['family'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findByFamily(familyId: string): Promise<DirectDebitMandate[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { family_id: familyId },
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findActiveByFamily(familyId: string): Promise<DirectDebitMandate | null> {
    return await this.scoped.scopedFindOne(this.repository, {
      where: {
        family_id: familyId,
        status: DirectDebitMandateStatus.ACTIVE,
      },
    });
  }

  async findByStatus(status: DirectDebitMandateStatus): Promise<DirectDebitMandate[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { status },
      relations: ['family'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<DirectDebitMandate | null> {
    // A mandate_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { mandate_id: id },
      relations: ['family'],
    });
  }

  async update(id: string, updateMandateDto: UpdateMandateDto): Promise<DirectDebitMandate | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateMandateDto as UpdateMandateDto & {
      club_id?: string;
    };
    await this.repository.update({ mandate_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async updateStatus(id: string, status: DirectDebitMandateStatus): Promise<void> {
    await this.repository.update(
      { mandate_id: id, club_id: this.tenantContext.getClubId() },
      { status },
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      mandate_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async countActive(): Promise<number> {
    return await this.repository.count({
      where: {
        status: DirectDebitMandateStatus.ACTIVE,
        club_id: this.tenantContext.getClubId(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Non-request (webhook / scheduled-job) variants.
  //
  // These run with NO tenant (CLS) context, so they MUST NOT call getClubId().
  // They are used only by webhook handlers and the payment-collection cron job.
  // They derive club_id from the provider-side id or from the entity being
  // processed. Never call these from a request-scoped path.
  // ---------------------------------------------------------------------------

  /**
   * Unscoped lookup by provider-side mandate id, from which the caller derives
   * club_id. The webhook endpoint is public (no tenant context); this is its
   * entry point to locate the mandate. Do not use on request paths.
   *
   * Scoped by provider as well as id, matching the (provider, provider_mandate_id)
   * unique: an id is only unique WITHIN a provider, so looking up by id alone
   * could return another provider's mandate.
   */
  async findByProviderId(
    provider: string,
    providerMandateId: string,
  ): Promise<DirectDebitMandate | null> {
    return await this.repository.findOne({
      where: { provider, provider_mandate_id: providerMandateId },
      relations: ['family'],
    });
  }

  /**
   * Unscoped status update, scoping the predicate by the explicitly supplied
   * club_id derived from the already-loaded mandate. Used by the GoCardless
   * webhook handler, which has no tenant context. Do not use on request paths.
   */
  async updateStatusForClub(
    id: string,
    clubId: string,
    status: DirectDebitMandateStatus,
  ): Promise<void> {
    await this.repository.update({ mandate_id: id, club_id: clubId }, { status });
  }

  /**
   * Unscoped lookup of active mandates for a family, scoped to the explicitly
   * supplied club_id (derived from the parent invoice). Used by the
   * payment-collection cron job. Do not use on request paths.
   */
  async findByFamilyForClub(familyId: string, clubId: string): Promise<DirectDebitMandate[]> {
    return await this.repository.find({
      where: { family_id: familyId, club_id: clubId },
      order: {
        created_at: 'DESC',
      },
    });
  }
}
