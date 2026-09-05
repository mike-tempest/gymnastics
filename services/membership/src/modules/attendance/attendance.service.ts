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

@Injectable()
export class AttendanceService {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  async create(createAttendanceDto: CreateAttendanceDto): Promise<Attendance> {
    try {
      // Check if attendance already exists for this session and member
      const existing = await this.attendanceRepository.findBySessionAndMember(
        createAttendanceDto.session_id,
        createAttendanceDto.member_id,
      );

      if (existing) {
        throw new ConflictException(
          'Attendance record already exists for this member and session',
        );
      }

      return await this.attendanceRepository.create(createAttendanceDto);
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        throw error;
      }
      if ((error as Record<string, unknown>).code === '23505') {
        // Unique constraint violation
        throw new ConflictException(
          'Attendance record already exists for this member and session',
        );
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
          console.error(
            `Failed to mark attendance for member ${attendanceDto.member_id}:`,
            error,
          );
        }
      }

      return results;
    } catch (error: unknown) {
      throw new BadRequestException('Failed to mark attendance for members');
    }
  }

  async checkInMember(sessionId: string, memberId: string): Promise<Attendance> {
    try {
      const existing = await this.attendanceRepository.findBySessionAndMember(
        sessionId,
        memberId,
      );

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

  async getSessionAttendance(sessionId: string): Promise<Attendance[]> {
    return await this.attendanceRepository.findBySession(sessionId);
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
