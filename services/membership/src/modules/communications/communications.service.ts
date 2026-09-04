import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CommunicationsRepository } from './communications.repository';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { Communication } from './entities/communication.entity';
import { EmailService } from '../email/email.service';
import { ClubsService } from '../clubs/clubs.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly communicationsRepository: CommunicationsRepository,
    private readonly emailService: EmailService,
    private readonly clubsService: ClubsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createCommunicationDto: CreateCommunicationDto): Promise<Communication> {
    // Persist the row first so the broadcast is durably recorded even if
    // outbound dispatch fails. Then resolve recipients and fan out emails
    // best-effort - we log per-recipient failures but never roll back the row.
    const communication = await this.communicationsRepository.create(createCommunicationDto);

    const recipients =
      await this.communicationsRepository.findRecipientEmails(createCommunicationDto);
    if (recipients.length === 0) {
      this.logger.warn(
        `Broadcast ${communication.communication_id} (${createCommunicationDto.recipientType}) has no recipients with email`,
      );
      return communication;
    }

    const club = await this.clubsService.findOne(this.tenantContext.getClubId());
    const clubName = club?.name ?? 'Your Swimming Club';

    const outcomes = await Promise.allSettled(
      recipients.map((r) =>
        this.emailService.sendBroadcast({
          recipientEmail: r.email,
          subject: createCommunicationDto.subject,
          body: createCommunicationDto.body,
          clubName,
        }),
      ),
    );
    const failed = outcomes.filter((o) => o.status === 'rejected').length;
    this.logger.log(
      `Broadcast ${communication.communication_id} dispatched to ${recipients.length - failed}/${recipients.length} recipients (${failed} failed)`,
    );
    return communication;
  }

  async findAll(): Promise<Communication[]> {
    return await this.communicationsRepository.findAll();
  }

  async findOne(id: string): Promise<Communication> {
    const communication = await this.communicationsRepository.findOne(id);
    if (!communication) {
      throw new NotFoundException(`Communication with ID ${id} not found`);
    }
    return communication;
  }
}
