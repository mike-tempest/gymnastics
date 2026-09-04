import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consent, ConsentType, ConsentStatus } from './entities/consent.entity';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class ConsentsRepository {
  constructor(
    @InjectRepository(Consent)
    private readonly consentRepository: Repository<Consent>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createDto: CreateConsentDto): Promise<Consent> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createDto as CreateConsentDto & { club_id?: string };
    const consent = this.consentRepository.create(
      this.scoped.stampCreate<Consent>({
        ...rest,
        granted_date: createDto.granted_date || new Date(),
      }),
    );
    return await this.consentRepository.save(consent);
  }

  async findAll(): Promise<Consent[]> {
    return await this.scoped.scopedFind(this.consentRepository, {
      relations: ['swimmer', 'granted_by'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Consent | null> {
    // A consent_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.consentRepository, {
      where: { consent_id: id },
      relations: ['swimmer', 'granted_by'],
    });
  }

  async findBySwimmer(swimmerId: string): Promise<Consent[]> {
    return await this.scoped.scopedFind(this.consentRepository, {
      where: { swimmer_id: swimmerId },
      relations: ['granted_by'],
      order: { created_at: 'DESC' },
    });
  }

  async findBySwimmerAndType(swimmerId: string, consentType: ConsentType): Promise<Consent | null> {
    const consents = await this.scoped.scopedFind(this.consentRepository, {
      where: { swimmer_id: swimmerId, consent_type: consentType },
      order: { created_at: 'DESC' },
    });

    return consents.length > 0 ? consents[0] : null;
  }

  async findByType(consentType: ConsentType): Promise<Consent[]> {
    return await this.scoped.scopedFind(this.consentRepository, {
      where: { consent_type: consentType },
      relations: ['swimmer', 'granted_by'],
      order: { created_at: 'DESC' },
    });
  }

  async findPendingConsents(): Promise<Consent[]> {
    return await this.scoped.scopedFind(this.consentRepository, {
      where: { status: ConsentStatus.PENDING },
      relations: ['swimmer', 'granted_by'],
      order: { created_at: 'ASC' },
    });
  }

  async findExpiringConsents(daysAhead: number = 30): Promise<Consent[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return await this.scoped
      .scopedQueryBuilder(this.consentRepository, 'consent')
      .leftJoinAndSelect('consent.swimmer', 'swimmer')
      .leftJoinAndSelect('consent.granted_by', 'granted_by')
      .andWhere('consent.expiry_date IS NOT NULL')
      .andWhere('consent.expiry_date <= :futureDate', { futureDate })
      .andWhere('consent.expiry_date >= :today', { today: new Date() })
      .andWhere('consent.status = :status', { status: ConsentStatus.GRANTED })
      .orderBy('consent.expiry_date', 'ASC')
      .getMany();
  }

  async update(id: string, updateDto: UpdateConsentDto): Promise<Consent | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const {
      metadata,
      club_id: _ignored,
      ...rest
    } = updateDto as UpdateConsentDto & {
      club_id?: string;
    };
    await this.consentRepository.update(
      { consent_id: id, club_id: this.tenantContext.getClubId() },
      {
        ...rest,
        ...(metadata !== undefined && { metadata: metadata as Record<string, string> }),
      },
    );
    return await this.findOne(id);
  }

  async revokeConsent(id: string, revokedBy: string): Promise<Consent | null> {
    await this.consentRepository.update(
      { consent_id: id, club_id: this.tenantContext.getClubId() },
      {
        status: ConsentStatus.REVOKED,
        revoked_date: new Date(),
        revoked_by_user_id: revokedBy,
      },
    );
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.consentRepository.delete({
      consent_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.consentRepository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async countByStatus(status: ConsentStatus): Promise<number> {
    return await this.consentRepository.count({
      where: { status, club_id: this.tenantContext.getClubId() },
    });
  }

  async countByType(consentType: ConsentType): Promise<number> {
    return await this.consentRepository.count({
      where: { consent_type: consentType, club_id: this.tenantContext.getClubId() },
    });
  }
}
