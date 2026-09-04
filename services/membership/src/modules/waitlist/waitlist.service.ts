import { Injectable, Logger } from '@nestjs/common';
import { WaitlistEntry } from './entities/waitlist.entity';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import { EmailService } from '../email/email.service';
import { WaitlistRepository } from './waitlist.repository';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly waitlistRepo: WaitlistRepository,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateWaitlistDto): Promise<{ success: boolean; message: string }> {
    let entry: WaitlistEntry | null = null;

    try {
      entry = this.waitlistRepo.createEntity({
        email: dto.email.toLowerCase().trim(),
        name: dto.name || null,
        clubName: dto.clubName || null,
        role: dto.role || null,
        source: dto.source || 'website',
      });
      await this.waitlistRepo.save(entry);
      this.logger.log(`New waitlist signup: ${entry.email}`);
    } catch (error: unknown) {
      // Duplicate email - return success anyway to avoid leaking info
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        this.logger.log(`Duplicate waitlist signup attempt: ${dto.email}`);
      } else {
        this.logger.error(
          `Waitlist signup error: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }

    // Fire and forget confirmation email for new signups
    if (entry?.id) {
      this.emailService
        .sendWaitlistConfirmation(entry)
        .then(() => {
          this.waitlistRepo.update(entry.id, { confirmationSentAt: new Date() });
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send waitlist confirmation to ${entry.email}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    }

    return { success: true, message: 'Thanks! We will be in touch.' };
  }

  async findAll(): Promise<WaitlistEntry[]> {
    return this.waitlistRepo.findAll();
  }

  async count(): Promise<number> {
    return this.waitlistRepo.count();
  }

  async processDrips(): Promise<{ sent: number }> {
    const now = new Date();
    let sent = 0;

    // Drip 1: confirmation sent, drip1 not sent, signed up 3+ days ago
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const drip1Entries = await this.waitlistRepo.findDripEligible(
      'confirmationSentAt',
      'drip1SentAt',
      threeDaysAgo,
    );

    for (const entry of drip1Entries) {
      try {
        await this.emailService.sendWaitlistDrip1(entry);
        await this.waitlistRepo.update(entry.id, { drip1SentAt: new Date() });
        sent++;
      } catch (error) {
        this.logger.error(
          `Failed to send drip 1 to ${entry.email}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Drip 2: drip1 sent, drip2 not sent, signed up 7+ days ago
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const drip2Entries = await this.waitlistRepo.findDripEligible(
      'drip1SentAt',
      'drip2SentAt',
      sevenDaysAgo,
    );

    for (const entry of drip2Entries) {
      try {
        await this.emailService.sendWaitlistDrip2(entry);
        await this.waitlistRepo.update(entry.id, { drip2SentAt: new Date() });
        sent++;
      } catch (error) {
        this.logger.error(
          `Failed to send drip 2 to ${entry.email}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    // Drip 3: drip2 sent, drip3 not sent, signed up 14+ days ago
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const drip3Entries = await this.waitlistRepo.findDripEligible(
      'drip2SentAt',
      'drip3SentAt',
      fourteenDaysAgo,
    );

    for (const entry of drip3Entries) {
      try {
        await this.emailService.sendWaitlistDrip3(entry);
        await this.waitlistRepo.update(entry.id, { drip3SentAt: new Date() });
        sent++;
      } catch (error) {
        this.logger.error(
          `Failed to send drip 3 to ${entry.email}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    this.logger.log(`Drip processing complete: ${sent} emails sent`);
    return { sent };
  }
}
