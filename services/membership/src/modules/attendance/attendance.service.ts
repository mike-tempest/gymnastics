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
      // Check if attendance already exists for this session and swimmer
      const existing = await this.attendanceRepository.findBySessionAndSwimmer(
        createAttendanceDto.session_id,
        createAttendanceDto.swimmer_id,
      );

      if (existing) {
        throw new ConflictException(
          'Attendance record already exists for this swimmer and session',
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
          'Attendance record already exists for this swimmer and session',
        );
      }
      throw error;
    }
  }

  async markAttendance(
    sessionId: string,
    markAttendanceDto: MarkAttendanceDto,
  ): Promise<Attendance[]> {
    const { swimmer_ids, status } = markAttendanceDto;

    if (!swimmer_ids || swimmer_ids.length === 0) {
      throw new BadRequestException('At least one swimmer ID is required');
    }

    const attendances: CreateAttendanceDto[] = swimmer_ids.map((swimmer_id) => ({
      session_id: sessionId,
      swimmer_id,
      status,
    }));

    try {
      // Use individual creates to handle duplicates gracefully
      const results: Attendance[] = [];
      for (const attendanceDto of attendances) {
        try {
          const existing = await this.attendanceRepository.findBySessionAndSwimmer(
            attendanceDto.session_id,
            attendanceDto.swimmer_id,
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
          // Log error but continue with other swimmers
          console.error(
            `Failed to mark attendance for swimmer ${attendanceDto.swimmer_id}:`,
            error,
          );
        }
      }

      return results;
    } catch (error: unknown) {
      throw new BadRequestException('Failed to mark attendance for swimmers');
    }
  }

  async checkInSwimmer(sessionId: string, swimmerId: string): Promise<Attendance> {
    try {
      const existing = await this.attendanceRepository.findBySessionAndSwimmer(
        sessionId,
        swimmerId,
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
          swimmer_id: swimmerId,
          status: AttendanceStatus.PRESENT,
        });
      }
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to check in swimmer');
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

  async getSwimmerAttendance(swimmerId: string): Promise<Attendance[]> {
    return await this.attendanceRepository.findBySwimmer(swimmerId);
  }

  async getSwimmerAttendanceStats(swimmerId: string): Promise<AttendanceStats> {
    return await this.attendanceRepository.getAttendanceStats(swimmerId);
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
