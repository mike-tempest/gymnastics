import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Communication, RecipientType } from './entities/communication.entity';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { Family } from '../families/entities/family.entity';
import { Member } from '../members/entities/member.entity';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class CommunicationsRepository {
  constructor(
    @InjectRepository(Communication)
    private readonly communicationRepository: Repository<Communication>,
    @InjectRepository(Family)
    private readonly familyRepository: Repository<Family>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createCommunicationDto: CreateCommunicationDto): Promise<Communication> {
    // This is a request-driven path (CommunicationsController). The active tenant
    // is available from CLS, so recipient counts and the new row are all scoped
    // to getClubId(). A supplied club_id is never trusted.
    const clubId = this.tenantContext.getClubId();

    // Calculate recipient count based on type, scoped to the active club so the
    // count never reflects another club's families/members.
    let recipientCount = 0;

    if (createCommunicationDto.recipientType === RecipientType.ALL) {
      recipientCount = await this.familyRepository.count({ where: { club_id: clubId } });
    } else if (
      createCommunicationDto.recipientType === RecipientType.SQUAD &&
      createCommunicationDto.squadId
    ) {
      // Count distinct families that have members in this squad (this club only).
      const result = await this.memberRepository
        .createQueryBuilder('member')
        .select('COUNT(DISTINCT member.family_id)', 'count')
        .where('member.club_id = :clubId', { clubId })
        .andWhere('member.squad_id = :squadId', { squadId: createCommunicationDto.squadId })
        .andWhere('member.family_id IS NOT NULL')
        .getRawOne();
      recipientCount = parseInt(result?.count ?? '0', 10);
    } else if (
      createCommunicationDto.recipientType === RecipientType.FAMILY &&
      createCommunicationDto.familyId
    ) {
      recipientCount = 1;
    }

    const communication = this.communicationRepository.create(
      this.scoped.stampCreate<Communication>({
        subject: createCommunicationDto.subject,
        body: createCommunicationDto.body,
        recipient_type: createCommunicationDto.recipientType,
        squad_id: createCommunicationDto.squadId || null,
        family_id: createCommunicationDto.familyId || null,
        recipient_count: recipientCount,
      }),
    );

    return await this.communicationRepository.save(communication);
  }

  // Resolve recipient_type into the actual list of email addresses to send to,
  // scoped to the active club. Skips families with no primary_contact_email.
  async findRecipientEmails(
    dto: CreateCommunicationDto,
  ): Promise<Array<{ email: string; familyName: string }>> {
    const clubId = this.tenantContext.getClubId();

    if (dto.recipientType === RecipientType.ALL) {
      const families = await this.familyRepository.find({
        where: { club_id: clubId },
        select: ['primary_contact_email', 'family_name'],
      });
      return families
        .filter((f) => f.primary_contact_email)
        .map((f) => ({ email: f.primary_contact_email, familyName: f.family_name }));
    }

    if (dto.recipientType === RecipientType.SQUAD && dto.squadId) {
      const rows = await this.memberRepository
        .createQueryBuilder('member')
        .innerJoin('families', 'family', 'family.family_id = member.family_id')
        .select('DISTINCT family.primary_contact_email', 'email')
        .addSelect('family.family_name', 'family_name')
        .where('member.club_id = :clubId', { clubId })
        .andWhere('member.squad_id = :squadId', { squadId: dto.squadId })
        .andWhere('family.primary_contact_email IS NOT NULL')
        .getRawMany<{ email: string; family_name: string }>();
      return rows.map((r) => ({ email: r.email, familyName: r.family_name }));
    }

    if (dto.recipientType === RecipientType.FAMILY && dto.familyId) {
      const family = await this.familyRepository.findOne({
        where: { family_id: dto.familyId, club_id: clubId },
        select: ['primary_contact_email', 'family_name'],
      });
      if (!family || !family.primary_contact_email) return [];
      return [{ email: family.primary_contact_email, familyName: family.family_name }];
    }

    return [];
  }

  async findAll(): Promise<Communication[]> {
    return await this.scoped.scopedFind(this.communicationRepository, {
      relations: ['squad', 'family'],
      order: { sent_date: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Communication | null> {
    // A communication_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.communicationRepository, {
      where: { communication_id: id },
      relations: ['squad', 'family'],
    });
  }
}
