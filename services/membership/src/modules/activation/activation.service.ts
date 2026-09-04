import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Club } from '../clubs/entities/club.entity';
import { Session } from '../sessions/entities/session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Clubs older than this are outside the activation window and are never
 * emailed by this sequence, including every club that existed before the
 * feature shipped.
 */
const WINDOW_DAYS = 15;

/** The club-local hour at which activation emails go out. */
const SEND_HOUR = 9;

/**
 * Post-signup activation email sequence. Day 0 is the welcome email sent at
 * signup by AuthService; this cron covers the rest:
 *
 * - day 2: "put this week's sessions in" (suppressed if a future-dated
 *   session already exists)
 * - day 5: "take your first register poolside" (suppressed if any register
 *   has been taken)
 * - day 10: plain-text "what stopped you?" with replies to Mike (suppressed
 *   only if the club has BOTH scheduled ahead and taken a register)
 *
 * BACKGROUND/CRON PATH: runs with no authenticated request and no tenant
 * context, so it uses plain repositories with explicit club_id filters,
 * never the tenant-scoped helpers. Timezone handling follows the
 * session-reminder pattern: an hourly poll that dispatches only to clubs
 * whose current local hour matches SEND_HOUR.
 *
 * Idempotency: each step stamps its clubs column when handled, whether the
 * email was sent or deliberately suppressed. At most one email is sent per
 * club per run, so a club that crossed several thresholds while the job was
 * down is drip-fed rather than burst three emails at once.
 */
@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    @InjectRepository(Club) private readonly clubsRepository: Repository<Club>,
    @InjectRepository(Session) private readonly sessionsRepository: Repository<Session>,
    @InjectRepository(Attendance) private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  /** Injectable clock seam so tests can pin "now". */
  protected now(): Date {
    return new Date();
  }

  /** The club's current local hour, via Intl in the club's IANA timezone. */
  private clubLocalHour(club: Club, at: Date): number {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: club.timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at);
    return parseInt(formatted, 10);
  }

  /** The club's local calendar date as YYYY-MM-DD ('en-CA' emits ISO order). */
  private clubLocalToday(club: Club, at: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: club.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  }

  // Offset from the session-reminder cron (minute 0) so the two hourly jobs
  // do not contend. ScheduleModule.forRoot() lives in AppModule only.
  @Cron('30 * * * *', { name: 'activation-emails' })
  async processActivationEmails(): Promise<void> {
    const now = this.now();

    const clubs = await this.clubsRepository.find({
      where: { created_at: MoreThan(new Date(now.getTime() - WINDOW_DAYS * DAY_MS)) },
    });

    for (const club of clubs) {
      const allHandled =
        club.activation_day2_sent_at &&
        club.activation_day5_sent_at &&
        club.activation_day10_sent_at;
      if (allHandled) {
        continue;
      }
      if (this.clubLocalHour(club, now) !== SEND_HOUR) {
        continue;
      }

      try {
        await this.processClub(club, now);
      } catch (error) {
        this.logger.error(
          `Activation processing failed for club ${club.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async processClub(club: Club, now: Date): Promise<void> {
    const ageDays = Math.floor((now.getTime() - new Date(club.created_at).getTime()) / DAY_MS);
    if (ageDays < 2) {
      return;
    }

    const admin = await this.usersRepository.findOne({
      where: { club_id: club.id, role: UserRole.SUPER_ADMIN },
      order: { created_at: 'ASC' },
    });
    if (!admin) {
      this.logger.warn(`Club ${club.id} has no super admin; skipping activation emails`);
      return;
    }

    const emailData = {
      recipientEmail: admin.email,
      firstName: admin.first_name,
      clubName: club.name,
    };
    let sentThisRun = false;

    if (!club.activation_day2_sent_at && ageDays >= 2) {
      if (!(await this.hasFutureSession(club, now))) {
        await this.emailService.sendActivationScheduleSessions(emailData);
        sentThisRun = true;
      }
      await this.stamp(club, 'activation_day2_sent_at', now);
    }

    if (!sentThisRun && !club.activation_day5_sent_at && ageDays >= 5) {
      if (!(await this.hasTakenRegister(club))) {
        await this.emailService.sendActivationFirstRegister(emailData);
        sentThisRun = true;
      }
      await this.stamp(club, 'activation_day5_sent_at', now);
    }

    if (!sentThisRun && !club.activation_day10_sent_at && ageDays >= 10) {
      const activated =
        (await this.hasFutureSession(club, now)) && (await this.hasTakenRegister(club));
      if (!activated) {
        await this.emailService.sendActivationCheckIn(emailData);
      }
      await this.stamp(club, 'activation_day10_sent_at', now);
    }
  }

  private async hasFutureSession(club: Club, now: Date): Promise<boolean> {
    const count = await this.sessionsRepository.count({
      where: {
        club_id: club.id,
        session_date: MoreThanOrEqual(this.clubLocalToday(club, now) as unknown as Date),
      },
    });
    return count > 0;
  }

  private async hasTakenRegister(club: Club): Promise<boolean> {
    const count = await this.attendanceRepository.count({ where: { club_id: club.id } });
    return count > 0;
  }

  private async stamp(
    club: Club,
    column: 'activation_day2_sent_at' | 'activation_day5_sent_at' | 'activation_day10_sent_at',
    at: Date,
  ): Promise<void> {
    club[column] = at;
    await this.clubsRepository.update({ id: club.id }, { [column]: at });
  }
}
