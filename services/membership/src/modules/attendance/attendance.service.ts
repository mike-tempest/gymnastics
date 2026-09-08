import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AttendanceRepository, AttendanceStats } from './attendance.repository';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { MembersRepository } from '../members/members.repository';
import { SessionsRepository } from '../sessions/sessions.repository';
import { Member } from '../members/entities/member.entity';

/**
 * One line of a session register: an attendance row where one exists, and a
 * placeholder for a squad member nobody has marked yet.
 *
 * `attendance_status_enum` has no "not yet marked" value, and adding one would
 * make an unmarked gymnast indistinguishable from a marked one in the counts,
 * the stats and the printed register. So an unmarked gymnast is represented by
 * the absence of a row: a null `attendance_id` and a null `status`. Nothing is
 * written to the database until a coach actually marks somebody.
 */
export interface SessionRosterEntry {
  attendance_id: string | null;
  club_id: string;
  session_id: string;
  member_id: string;
  status: AttendanceStatus | null;
  checked_in_at: Date | null;
  notes: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  member?: Member;
}

/** Registers read down a list of names, so the roster is ordered by name. */
function byName(a: SessionRosterEntry, b: SessionRosterEntry): number {
  const lastName = (a.member?.last_name ?? '').localeCompare(b.member?.last_name ?? '');
  if (lastName !== 0) return lastName;

  const firstName = (a.member?.first_name ?? '').localeCompare(b.member?.first_name ?? '');
  if (firstName !== 0) return firstName;

  // Two gymnasts can share a name; member_id keeps the order stable between requests.
  return a.member_id.localeCompare(b.member_id);
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly membersRepository: MembersRepository,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  async create(createAttendanceDto: CreateAttendanceDto): Promise<Attendance> {
    try {
      // Check if attendance already exists for this session and member
      const existing = await this.attendanceRepository.findBySessionAndMember(
        createAttendanceDto.session_id,
        createAttendanceDto.member_id,
      );

      if (existing) {
        throw new ConflictException('Attendance record already exists for this member and session');
      }

      return await this.attendanceRepository.create(createAttendanceDto);
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if ((error as Record<string, unknown>).code === '23505') {
        // Unique constraint violation
        throw new ConflictException('Attendance record already exists for this member and session');
      }
      throw error;
    }
  }

  async markAttendance(
    sessionId: string,
    markAttendanceDto: MarkAttendanceDto,
  ): Promise<Attendance[]> {
    const { member_ids, status } = markAttendanceDto;

    if (!member_ids || member_ids.length === 0) {
      throw new BadRequestException('At least one member ID is required');
    }

    const attendances: CreateAttendanceDto[] = member_ids.map((member_id) => ({
      session_id: sessionId,
      member_id,
      status,
    }));

    try {
      // Use individual creates to handle duplicates gracefully
      const results: Attendance[] = [];
      for (const attendanceDto of attendances) {
        try {
          const existing = await this.attendanceRepository.findBySessionAndMember(
            attendanceDto.session_id,
            attendanceDto.member_id,
          );

          if (existing) {
            // Update existing record
            const updated = await this.attendanceRepository.update(existing.attendance_id, {
              status: attendanceDto.status,
            });
            if (updated) {
              results.push(updated);
            }
          } else {
            // Create new record
            const created = await this.attendanceRepository.create(attendanceDto);
            results.push(created);
          }
        } catch (error: unknown) {
          // Log error but continue with other members
          console.error(`Failed to mark attendance for member ${attendanceDto.member_id}:`, error);
        }
      }

      return results;
    } catch (error: unknown) {
      throw new BadRequestException('Failed to mark attendance for members');
    }
  }

  async checkInMember(sessionId: string, memberId: string): Promise<Attendance> {
    try {
      const existing = await this.attendanceRepository.findBySessionAndMember(sessionId, memberId);

      if (existing) {
        // Update existing record
        const updated = await this.attendanceRepository.update(existing.attendance_id, {
          status: AttendanceStatus.PRESENT,
          checked_in_at: new Date(),
        });

        if (!updated) {
          throw new NotFoundException('Attendance record not found');
        }

        return updated;
      } else {
        // Create new record
        return await this.attendanceRepository.create({
          session_id: sessionId,
          member_id: memberId,
          status: AttendanceStatus.PRESENT,
        });
      }
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to check in member');
    }
  }

  async findAll(): Promise<Attendance[]> {
    return await this.attendanceRepository.findAll();
  }

  async findOne(id: string): Promise<Attendance> {
    const attendance = await this.attendanceRepository.findOne(id);
    if (!attendance) {
      throw new NotFoundException(`Attendance record with ID ${id} not found`);
    }
    return attendance;
  }

  /**
   * The register for one session: everyone expected, marked or not.
   *
   * A scheduled session has no attendance rows yet, so returning only the rows
   * would hand a coach an empty register for the session they are about to
   * take, which is the one moment the feature exists for. The roster is
   * therefore the session's squad, with each member's attendance row attached
   * where one exists and a null-status placeholder where one does not.
   *
   * The union runs the other way too: a row is always returned even when its
   * member has since left the squad, so a mark a coach has already made can
   * never disappear from the register.
   *
   * Every read goes through a tenant-scoped repository, so a session id from
   * another club finds no session and no rows, and returns an empty register.
   */
  async getSessionRoster(sessionId: string): Promise<SessionRosterEntry[]> {
    const [session, existingRows] = await Promise.all([
      this.sessionsRepository.findOne(sessionId),
      this.attendanceRepository.findBySession(sessionId),
    ]);

    const rowsByMember = new Map(existingRows.map((row) => [row.member_id, row]));

    // A session need not have a squad. Without one there is no expected list,
    // so the register is whatever has already been marked.
    const squadMembers = session?.squad_id
      ? await this.membersRepository.findBySquadId(session.squad_id)
      : [];

    const roster: SessionRosterEntry[] = squadMembers.map((member) => {
      const row = rowsByMember.get(member.member_id);
      rowsByMember.delete(member.member_id);

      return row
        ? { ...row, member }
        : {
            attendance_id: null,
            club_id: member.club_id,
            session_id: sessionId,
            member_id: member.member_id,
            status: null,
            checked_in_at: null,
            notes: null,
            created_at: null,
            updated_at: null,
            member,
          };
    });

    // Whatever is left is marked but outside the squad. It belongs on the
    // register, in the same alphabetical run as everyone else.
    for (const row of rowsByMember.values()) {
      roster.push(row);
    }

    return roster.sort(byName);
  }

  async getMemberAttendance(memberId: string): Promise<Attendance[]> {
    return await this.attendanceRepository.findByMember(memberId);
  }

  async getMemberAttendanceStats(memberId: string): Promise<AttendanceStats> {
    return await this.attendanceRepository.getAttendanceStats(memberId);
  }

  async update(id: string, updateAttendanceDto: UpdateAttendanceDto): Promise<Attendance> {
    await this.findOne(id); // This will throw if not found

    try {
      const updated = await this.attendanceRepository.update(id, updateAttendanceDto);
      if (!updated) {
        throw new NotFoundException(`Attendance record with ID ${id} not found`);
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // This will throw if not found
    await this.attendanceRepository.remove(id);
  }
}
