import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsSelect, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import { CredentialStatus, CredentialType } from '@club-manager/shared-types';
import { Credential } from './entities/credential.entity';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

/** Relations loaded whenever a credential is shown or emailed about. */
const SUBJECT_RELATIONS = ['user', 'member'];

/**
 * Only the identifying fields of the holder are ever selected. Loading the
 * whole user row would put its password hash into every credential response,
 * so the columns are named explicitly rather than defaulted. Naming any
 * relation column means the root columns have to be listed too.
 */
const SUBJECT_SELECT: FindOptionsSelect<Credential> = {
  credential_id: true,
  club_id: true,
  user_id: true,
  member_id: true,
  credential_type: true,
  title: true,
  issuing_body: true,
  reference_number: true,
  issue_date: true,
  expiry_date: true,
  status: true,
  document_reference: true,
  notes: true,
  created_at: true,
  updated_at: true,
  created_by_user_id: true,
  user: { user_id: true, first_name: true, last_name: true, email: true },
  member: { member_id: true, first_name: true, last_name: true },
};

@Injectable()
export class CredentialsRepository {
  constructor(
    @InjectRepository(Credential)
    private readonly credentialRepository: Repository<Credential>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createDto: CreateCredentialDto, createdBy: string | null): Promise<Credential> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createDto as CreateCredentialDto & { club_id?: string };
    const credential = this.credentialRepository.create(
      this.scoped.stampCreate<Credential>({
        ...rest,
        // A subject the DTO left out is explicitly null, so the check
        // constraint sees a null rather than a missing column default.
        user_id: rest.user_id ?? null,
        member_id: rest.member_id ?? null,
        created_by_user_id: createdBy,
      }),
    );
    return await this.credentialRepository.save(credential);
  }

  async findAll(): Promise<Credential[]> {
    return await this.scoped.scopedFind(this.credentialRepository, {
      relations: SUBJECT_RELATIONS,
      select: SUBJECT_SELECT,
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Credential | null> {
    // A credential_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.credentialRepository, {
      where: { credential_id: id },
      relations: SUBJECT_RELATIONS,
      select: SUBJECT_SELECT,
    });
  }

  async findByUser(userId: string): Promise<Credential[]> {
    return await this.scoped.scopedFind(this.credentialRepository, {
      where: { user_id: userId },
      order: { issue_date: 'DESC' },
    });
  }

  async findByMember(memberId: string): Promise<Credential[]> {
    return await this.scoped.scopedFind(this.credentialRepository, {
      where: { member_id: memberId },
      order: { issue_date: 'DESC' },
    });
  }

  async findByReference(
    credentialType: CredentialType,
    referenceNumber: string,
  ): Promise<Credential | null> {
    // Scoped: the same certificate number issued to two clubs is not a clash.
    return await this.scoped.scopedFindOne(this.credentialRepository, {
      where: { credential_type: credentialType, reference_number: referenceNumber },
    });
  }

  /**
   * Credentials expiring on or before `daysAhead` days from today, including
   * ones that already lapsed, so the sweep sees the whole window in one read.
   * Rows already marked expired are excluded: they need no further action.
   */
  async findExpiringWithin(daysAhead: number): Promise<Credential[]> {
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + daysAhead);

    return await this.scoped.scopedFind(this.credentialRepository, {
      where: {
        expiry_date: LessThanOrEqual(horizon),
        status: Not(CredentialStatus.EXPIRED),
      },
      relations: SUBJECT_RELATIONS,
      select: SUBJECT_SELECT,
      order: { expiry_date: 'ASC' },
    });
  }

  /**
   * Everything whose expiry date has passed, whatever status the row carries.
   * Filtering on the date rather than on status matters: the overnight sweep
   * marks lapsed credentials EXPIRED, so a status-blind query would answer
   * "nothing has expired" from the morning after the first sweep. The horizon
   * is today's UTC midnight, so a credential expiring today is still in date.
   */
  async findExpired(): Promise<Credential[]> {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    return await this.scoped.scopedFind(this.credentialRepository, {
      where: { expiry_date: LessThan(startOfToday) },
      relations: SUBJECT_RELATIONS,
      select: SUBJECT_SELECT,
      order: { expiry_date: 'ASC' },
    });
  }

  async update(id: string, updateDto: UpdateCredentialDto): Promise<Credential | null> {
    // Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateDto as UpdateCredentialDto & { club_id?: string };
    // TypeORM throws on an update with no values, so an empty body is a no-op
    // read rather than a 500.
    if (Object.keys(rest).length > 0) {
      // Scope the affected-row predicate by club_id so a guessed id from
      // another club cannot be mutated.
      await this.credentialRepository.update(
        { credential_id: id, club_id: this.tenantContext.getClubId() },
        rest,
      );
    }
    return await this.findOne(id);
  }

  async setStatus(id: string, status: CredentialStatus): Promise<void> {
    await this.credentialRepository.update(
      { credential_id: id, club_id: this.tenantContext.getClubId() },
      { status },
    );
  }

  async remove(id: string): Promise<void> {
    await this.credentialRepository.delete({
      credential_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async countByStatus(status: CredentialStatus): Promise<number> {
    return await this.credentialRepository.count({
      where: { status, club_id: this.tenantContext.getClubId() },
    });
  }

  async count(): Promise<number> {
    return await this.credentialRepository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }
}
