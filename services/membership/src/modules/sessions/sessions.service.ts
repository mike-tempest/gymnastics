import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SessionsRepository } from './sessions.repository';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { Session, SessionStatus } from './entities/session.entity';
import { EmailService } from '../email/email.service';
import { MembersRepository } from '../members/members.repository';
import { FamiliesRepository } from '../families/families.repository';
import { Member } from '../members/entities/member.entity';
import { Family } from '../families/entities/family.entity';
import { ClubsRepository } from '../clubs/clubs.repository';
import { Club } from '../clubs/entities/club.entity';
import { formatClubDate, formatClubDateTime } from '../../common/region/format.util';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

/** A session enriched with register totals for dashboard consumption. */
export type SessionWithAttendance = Session & {
  attendance_count: number;
  total_members: number;
};

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly membersRepository: MembersRepository,
    private readonly familiesRepository: FamiliesRepository,
    private readonly clubsRepository: ClubsRepository,
    private readonly tenantContext: TenantContextService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  /**
   * Injectable clock seam so tests can pin "now". Production always uses the
   * real wall clock; tests override this to assert per-timezone selection.
   */
  protected now(): Date {
    return new Date();
  }

  /**
   * The club's current local hour (0-23) for the given instant. Computed via
   * Intl in the club's IANA timezone. The 'en-GB' locale here only influences
   * the numeral formatting of the hour, which is irrelevant to the parsed
   * integer, so it carries no regional meaning.
   */
  private clubLocalHour(club: Club, at: Date): number {
    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: club.timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at);
    return parseInt(formatted, 10);
  }

  /**
   * The club's local calendar date, one day after the given instant, as an
   * ISO YYYY-MM-DD string. "Tomorrow" is resolved in the club's own timezone
   * so a session dated for the club's local tomorrow is matched regardless of
   * the server's timezone. The 'en-CA' locale is used only because it emits
   * the ISO YYYY-MM-DD ordering; it carries no regional meaning here.
   */
  private clubLocalTomorrow(club: Club, at: Date): string {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: club.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  async create(createSessionDto: CreateSessionDto): Promise<Session> {
    try {
      // Validate that end_time is after start_time
      if (createSessionDto.start_time >= createSessionDto.end_time) {
        throw new BadRequestException('End time must be after start time');
      }

      return await this.sessionsRepository.create(createSessionDto);
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw error;
    }
  }

  async findAll(): Promise<Session[]> {
    return await this.sessionsRepository.findAll();
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.sessionsRepository.findOne(id);
    if (!session) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }
    return session;
  }

  async getUpcomingSessions(limit?: number): Promise<Session[]> {
    return await this.sessionsRepository.findUpcoming(limit);
  }

  /**
   * The club's local calendar date for the given instant, as YYYY-MM-DD. The
   * 'en-CA' locale is used only because it emits the ISO ordering; it carries
   * no regional meaning here.
   */
  private clubLocalToday(timezone: string, at: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  }

  /**
   * Sessions from the last `days` calendar days (inclusive of today), resolved
   * in the club's own timezone, each enriched with register totals so the
   * dashboard can show a real attendance rate. Sessions with no register carry
   * zero totals and read as "no attendance recorded".
   */
  async getRecentSessions(days: number = 7): Promise<SessionWithAttendance[]> {
    const windowDays = Math.min(Math.max(Math.trunc(days) || 7, 1), 31);

    const club = await this.clubsRepository.findOne(this.tenantContext.getClubId());
    const now = this.now();
    const endIso = club?.timezone
      ? this.clubLocalToday(club.timezone, now)
      : now.toISOString().split('T')[0];

    const start = new Date(`${endIso}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - (windowDays - 1));
    const startIso = start.toISOString().split('T')[0];

    const sessions = await this.sessionsRepository.findRecentBetween(startIso, endIso);
    const counts = await this.sessionsRepository.attendanceCountsBySession(
      sessions.map((session) => session.session_id),
    );
    const countsBySession = new Map(counts.map((row) => [row.session_id, row]));

    return sessions.map((session) => {
      const row = countsBySession.get(session.session_id);
      return {
        ...session,
        attendance_count: row ? parseInt(row.attended, 10) || 0 : 0,
        total_members: row ? parseInt(row.total, 10) || 0 : 0,
      };
    });
  }

  async getSessionsBySquad(squadId: string): Promise<Session[]> {
    return await this.sessionsRepository.findBySquad(squadId);
  }

  async getSessionsByDateRange(startDate: Date, endDate: Date): Promise<Session[]> {
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }
    return await this.sessionsRepository.findByDateRange(startDate, endDate);
  }

  async updateSessionStatus(id: string, status: SessionStatus): Promise<Session> {
    await this.findOne(id); // This will throw if not found

    // Validate status transitions
    const validStatuses = Object.values(SessionStatus);
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const updated = await this.sessionsRepository.update(id, { status });
    if (!updated) {
      throw new NotFoundException(`Session with ID ${id} not found`);
    }

    if (status === SessionStatus.CANCELLED && updated.squad_id) {
      this.sendSessionCancelledNotifications(updated);
    }

    return updated;
  }

  async update(id: string, updateSessionDto: UpdateSessionDto): Promise<Session> {
    const existing = await this.findOne(id); // This will throw if not found

    // Validate that end_time is after start_time if both are provided
    if (updateSessionDto.start_time && updateSessionDto.end_time) {
      if (updateSessionDto.start_time >= updateSessionDto.end_time) {
        throw new BadRequestException('End time must be after start time');
      }
    } else if (updateSessionDto.start_time && !updateSessionDto.end_time) {
      if (updateSessionDto.start_time >= existing.end_time) {
        throw new BadRequestException('End time must be after start time');
      }
    } else if (!updateSessionDto.start_time && updateSessionDto.end_time) {
      if (existing.start_time >= updateSessionDto.end_time) {
        throw new BadRequestException('End time must be after start time');
      }
    }

    try {
      const updated = await this.sessionsRepository.update(id, updateSessionDto);
      if (!updated) {
        throw new NotFoundException(`Session with ID ${id} not found`);
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.sessionsRepository.remove(id);
  }

  async getStatistics() {
    const total = await this.sessionsRepository.count();
    return {
      total,
    };
  }

  /**
   * Scheduled job to send session reminder emails. Runs hourly and dispatches
   * reminders only to clubs whose CURRENT LOCAL hour is 18 (6 PM), so every
   * club receives its reminders at 6 PM in its own timezone rather than at 6 PM
   * UK time. Reminders cover sessions dated for the club's local tomorrow.
   *
   * DST edge: on the two days a year a timezone skips or repeats a wall-clock
   * hour, the local 18:00 tick can be missed or occur twice for a given club.
   * That once-a-year skew is an accepted trade-off for the simplicity of an
   * hourly poll keyed on the local hour.
   */
  @Cron('0 * * * *', {
    name: 'session-reminders',
  })
  async sendSessionReminders(): Promise<void> {
    this.logger.log('Starting scheduled session reminder emails job');

    try {
      const now = this.now();

      // Load candidate sessions across a two-day window (server today and
      // tomorrow). This covers every club's local "tomorrow" regardless of its
      // UTC offset; each club is then narrowed to its own local tomorrow below.
      const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

      const sessions = await this.sessionsRepository.findSessionsForRemindersBetween(
        windowStart,
        windowEnd,
      );

      if (sessions.length === 0) {
        this.logger.log('No candidate sessions in reminder window - skipping reminder emails');
        return;
      }

      // Group candidate sessions by club so we can resolve each club's timezone
      // and local date once.
      const sessionsByClub = new Map<string, Session[]>();
      for (const session of sessions) {
        const list = sessionsByClub.get(session.club_id);
        if (list) {
          list.push(session);
        } else {
          sessionsByClub.set(session.club_id, [session]);
        }
      }

      const clubs = await Promise.all(
        [...sessionsByClub.keys()].map((clubId) => this.clubsRepository.findOne(clubId)),
      );

      for (const club of clubs) {
        if (!club) {
          continue;
        }

        // Only dispatch when it is 6 PM in the club's own timezone.
        if (this.clubLocalHour(club, now) !== 18) {
          continue;
        }

        const localTomorrow = this.clubLocalTomorrow(club, now);
        const clubSessions = (sessionsByClub.get(club.id) ?? []).filter(
          (session) => this.sessionDateIso(session.session_date) === localTomorrow,
        );

        if (clubSessions.length === 0) {
          continue;
        }

        this.logger.log(
          `Found ${clubSessions.length} session(s) for club ${club.id} scheduled for its local tomorrow`,
        );

        for (const session of clubSessions) {
          this.sendRemindersForSession(session, club);
        }
      }

      this.logger.log('Session reminder emails job completed successfully');
    } catch (error) {
      this.logger.error(
        'Error in session reminder emails job:',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Normalises a session's stored date (a DATE column, materialised by TypeORM
   * as either a Date or a YYYY-MM-DD string) to a YYYY-MM-DD string for
   * comparison against a club's local tomorrow.
   */
  private sessionDateIso(sessionDate: Date | string): string {
    if (sessionDate instanceof Date) {
      return sessionDate.toISOString().split('T')[0];
    }
    return String(sessionDate).split('T')[0];
  }

  /**
   * Sends one reminder email per family for a single session, formatting all
   * dates and times in the club's locale and timezone.
   */
  private sendRemindersForSession(session: Session, club: Club): void {
    if (!session.squad?.members || session.squad.members.length === 0) {
      this.logger.warn(`Session ${session.session_id} has no members - skipping`);
      return;
    }

    // Group members by family to send one email per family
    const familyMap = new Map<string, { family: Family; members: Member[] }>();

    for (const member of session.squad.members) {
      if (!member.family) {
        this.logger.warn(`Member ${member.member_id} has no family - skipping`);
        continue;
      }

      const familyId = member.family.family_id;
      if (!familyMap.has(familyId)) {
        familyMap.set(familyId, {
          family: member.family,
          members: [],
        });
      }
      familyMap.get(familyId)!.members.push(member);
    }

    // Send email to each family
    for (const [familyId, { family, members }] of familyMap) {
      if (!family.primary_contact_email) {
        this.logger.warn(`Family ${familyId} has no email - skipping`);
        continue;
      }

      const memberNames = members.map((s: Member) => `${s.first_name} ${s.last_name}`).join(', ');

      // The session date and start_time are the club's local wall-clock values.
      // Anchor them as a UTC instant carrying exactly those components and
      // render that instant in UTC, so the displayed wall clock is unchanged
      // and only the locale-specific number and separator style varies. This
      // keeps a GB club byte-identical to the previous behaviour while giving
      // every other locale its own date/time formatting.
      const [startHours, startMinutes] = session.start_time.split(':');
      const [dateYear, dateMonth, dateDay] = this.sessionDateIso(session.session_date)
        .split('-')
        .map((part) => parseInt(part, 10));
      const sessionDateTime = new Date(
        Date.UTC(dateYear, dateMonth - 1, dateDay, parseInt(startHours), parseInt(startMinutes)),
      );

      // Calculate duration
      const [endHours, endMinutes] = session.end_time.split(':');
      const durationMinutes =
        parseInt(endHours) * 60 +
        parseInt(endMinutes) -
        (parseInt(startHours) * 60 + parseInt(startMinutes));
      const duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;

      this.emailService
        .sendSessionReminder({
          recipientEmail: family.primary_contact_email,
          parentName: family.primary_contact_name || family.family_name,
          memberName: members.length === 1 ? members[0].first_name : undefined,
          multipleMembers: members.length > 1,
          sessionType: session.session_name,
          sessionTime: session.start_time,
          sessionDate: formatClubDate(sessionDateTime, club.locale, 'UTC', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          fullDateTime: formatClubDateTime(sessionDateTime, club.locale, 'UTC'),
          timeUntilSession: '24 hours',
          squadName: session.squad?.squad_name || 'TBC',
          poolName: session.location || 'Main Pool',
          poolAddress: session.location || 'TBC',
          duration,
          coachName: session.coach_name ?? undefined,
          members: members.map((s: Member) => ({ name: `${s.first_name} ${s.last_name}` })),
          sessionNotes: session.description ?? undefined,
          viewSessionUrl: `${this.appUrl}/sessions/${session.session_id}`,
        })
        .catch((error: Error) => {
          this.logger.error(
            `Failed to send session reminder to ${family.primary_contact_email}:`,
            error.stack,
          );
        });

      this.logger.log(
        `Session reminder sent to ${family.primary_contact_email} for ${memberNames}`,
      );
    }
  }

  private sendSessionCancelledNotifications(session: Session): void {
    (async () => {
      try {
        if (!session.squad_id) return;
        const members = await this.membersRepository.findBySquadId(session.squad_id);
        if (members.length === 0) return;

        // Group by family to send one notification per family
        const familyIds = [
          ...new Set(members.map((s) => s.family_id).filter(Boolean) as string[]),
        ];

        // Resolve the club so the cancellation date is formatted in the club's
        // own locale. The stored date is the club's local wall-clock date, so
        // anchor its components as a UTC instant and render in UTC, keeping a
        // GB club byte-identical while other locales get their own style.
        const club = await this.clubsRepository.findOne(session.club_id);
        if (!club) {
          this.logger.warn(
            `Club ${session.club_id} not found for cancelled session ${session.session_id} - skipping notifications`,
          );
          return;
        }
        const locale = club.locale;
        const sessionDateIso = this.sessionDateIso(session.session_date);
        const [year, month, day] = sessionDateIso.split('-').map((part) => parseInt(part, 10));
        const sessionDateInstant = new Date(Date.UTC(year, month - 1, day));

        for (const familyId of familyIds) {
          try {
            const family = await this.familiesRepository.findOne(familyId);
            if (!family || !family.primary_contact_email) continue;

            await this.emailService.sendSessionCancelled({
              recipientEmail: family.primary_contact_email,
              memberName: family.primary_contact_name || family.family_name,
              sessionName: session.session_name,
              sessionDate: formatClubDate(sessionDateInstant, locale, 'UTC'),
              sessionTime: session.start_time,
              location: session.location ?? undefined,
              squadName: session.squad?.squad_name || 'Unknown Squad',
            });
          } catch (error) {
            this.logger.error(
              `Failed to notify family ${familyId} of session cancellation: ${(error as Error).message}`,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to send session cancellation notifications: ${(error as Error).message}`,
        );
      }
    })();
  }
}
