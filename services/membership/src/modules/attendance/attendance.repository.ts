import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

export interface AttendanceStats {
  total_sessions: number;
  attended: number;
  late: number;
  absent: number;
  excused: number;
  attendance_rate: number;
}

@Injectable()
export class AttendanceRepository {
  constructor(
    @InjectRepository(Attendance)
    private readonly repository: Repository<Attendance>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createAttendanceDto: CreateAttendanceDto): Promise<Attendance> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createAttendanceDto as CreateAttendanceDto & {
      club_id?: string;
    };
    const attendance = this.repository.create(this.scoped.stampCreate<Attendance>(rest));
    return await this.repository.save(attendance);
  }

  async createMany(createAttendanceDtos: CreateAttendanceDto[]): Promise<Attendance[]> {
    // Stamp every row with the active tenant's club_id.
    const stamped = createAttendanceDtos.map((dto) => {
      const { club_id: _ignored, ...rest } = dto as CreateAttendanceDto & { club_id?: string };
      return this.scoped.stampCreate<Attendance>(rest);
    });
    const attendances = this.repository.create(stamped);
    return await this.repository.save(attendances);
  }

  async findAll(): Promise<Attendance[]> {
    return await this.scoped.scopedFind(this.repository, {
      relations: ['swimmer'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Attendance | null> {
    // An attendance_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { attendance_id: id },
      relations: ['swimmer'],
    });
  }

  async findBySession(sessionId: string): Promise<Attendance[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { session_id: sessionId },
      relations: ['swimmer'],
      order: {
        created_at: 'ASC',
      },
    });
  }

  async findBySwimmer(swimmerId: string): Promise<Attendance[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { swimmer_id: swimmerId },
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findBySwimmerAndDateRange(
    swimmerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: {
        swimmer_id: swimmerId,
        created_at: Between(startDate, endDate),
      },
      order: {
        created_at: 'DESC',
      },
    });
  }

  async getAttendanceStats(swimmerId: string): Promise<AttendanceStats> {
    const allAttendance = await this.findBySwimmer(swimmerId);

    const total_sessions = allAttendance.length;
    const attended = allAttendance.filter((a) => a.status === AttendanceStatus.PRESENT).length;
    const late = allAttendance.filter((a) => a.status === AttendanceStatus.LATE).length;
    const absent = allAttendance.filter((a) => a.status === AttendanceStatus.ABSENT).length;
    const excused = allAttendance.filter((a) => a.status === AttendanceStatus.EXCUSED).length;

    const attendance_rate =
      total_sessions > 0 ? Math.round((attended / total_sessions) * 100 * 100) / 100 : 0;

    return {
      total_sessions,
      attended,
      late,
      absent,
      excused,
      attendance_rate,
    };
  }

  async findBySessionAndSwimmer(sessionId: string, swimmerId: string): Promise<Attendance | null> {
    return await this.scoped.scopedFindOne(this.repository, {
      where: {
        session_id: sessionId,
        swimmer_id: swimmerId,
      },
    });
  }

  async update(id: string, updateAttendanceDto: UpdateAttendanceDto): Promise<Attendance | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateAttendanceDto as UpdateAttendanceDto & {
      club_id?: string;
    };
    await this.repository.update(
      { attendance_id: id, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      attendance_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }
}
