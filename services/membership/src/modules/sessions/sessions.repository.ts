import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repository: Repository<Session>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createSessionDto: CreateSessionDto): Promise<Session> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createSessionDto as CreateSessionDto & {
      club_id?: string;
    };
    const session = this.repository.create(this.scoped.stampCreate<Session>(rest));
    return await this.repository.save(session);
  }

  async findAll(): Promise<Session[]> {
    return await this.scoped.scopedFind(this.repository, {
      relations: ['squad'],
      order: {
        session_date: 'DESC',
        start_time: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Session | null> {
    // A session_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { session_id: id },
      relations: ['squad'],
    });
  }

  async findBySquad(squadId: string): Promise<Session[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { squad_id: squadId },
      relations: ['squad'],
      order: {
        session_date: 'DESC',
        start_time: 'DESC',
      },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Session[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: {
        session_date: Between(startDate, endDate),
      },
      relations: ['squad'],
      order: {
        session_date: 'ASC',
        start_time: 'ASC',
      },
    });
  }

  async findUpcoming(limit?: number): Promise<Session[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = this.scoped
      .scopedQueryBuilder(this.repository, 'session')
      .leftJoinAndSelect('session.squad', 'squad')
      .andWhere('session.session_date >= :today', { today })
      .orderBy('session.session_date', 'ASC')
      .addOrderBy('session.start_time', 'ASC');

    if (limit) {
      query.take(limit);
    }

    return await query.getMany();
  }

  /**
   * Sessions dated within the inclusive [startIso, endIso] window (both
   * YYYY-MM-DD strings). The caller resolves the window in the club's own
   * timezone; comparing date strings against the DATE column avoids any
   * server-timezone drift.
   */
  async findRecentBetween(startIso: string, endIso: string): Promise<Session[]> {
    return await this.scoped
      .scopedQueryBuilder(this.repository, 'session')
      .leftJoinAndSelect('session.squad', 'squad')
      .andWhere('session.session_date BETWEEN :startIso AND :endIso', { startIso, endIso })
      .orderBy('session.session_date', 'DESC')
      .addOrderBy('session.start_time', 'DESC')
      .getMany();
  }

  /**
   * Register totals for the given sessions: how many swimmers were marked at
   * all, and how many of those were present or late. Sessions with no register
   * simply return no row.
   */
  async attendanceCountsBySession(
    sessionIds: string[],
  ): Promise<Array<{ session_id: string; total: string; attended: string }>> {
    if (sessionIds.length === 0) {
      return [];
    }

    return await this.repository.manager
      .createQueryBuilder()
      .select('attendance.session_id', 'session_id')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        "SUM(CASE WHEN attendance.status IN ('present', 'late') THEN 1 ELSE 0 END)",
        'attended',
      )
      .from('attendance', 'attendance')
      .where('attendance.session_id IN (:...sessionIds)', { sessionIds })
      .groupBy('attendance.session_id')
      .getRawMany();
  }

  async findByStatus(status: string): Promise<Session[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { status: status as SessionStatus },
      relations: ['squad'],
      order: {
        session_date: 'DESC',
        start_time: 'DESC',
      },
    });
  }

  async update(id: string, updateSessionDto: UpdateSessionDto): Promise<Session | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateSessionDto as UpdateSessionDto & {
      club_id?: string;
    };
    await this.repository.update({ session_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      session_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  /**
   * Find SCHEDULED sessions dated on the given day (an ISO YYYY-MM-DD string)
   * that need reminder emails. Loads the squad, its swimmers and each swimmer's
   * family so the caller can dispatch one email per family.
   *
   * BACKGROUND/CRON PATH: this is invoked from SessionsService.sendSessionReminders,
   * an @Cron job that runs with no authenticated request and therefore no tenant
   * (CLS) context. It must NOT call getClubId(); instead it is an intentional
   * cross-club sweep. Each loaded session row already carries its own club_id, so
   * downstream dispatch derives the tenant from the row, not from request context.
   *
   * The target day is supplied by the caller rather than computed here, because
   * "tomorrow" must be resolved in each club's own timezone, not server time.
   */
  async findSessionsForRemindersBetween(fromDate: string, toDate: string): Promise<Session[]> {
    return await this.repository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.squad', 'squad')
      .leftJoinAndSelect('squad.swimmers', 'swimmers')
      .leftJoinAndSelect('swimmers.family', 'family')
      .where('session.status = :status', { status: 'scheduled' })
      .andWhere('session.session_date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .orderBy('session.start_time', 'ASC')
      .getMany();
  }
}
