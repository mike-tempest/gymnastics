import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Member } from '../members/entities/member.entity';
import { Family } from '../families/entities/family.entity';
import { Squad } from '../squads/entities/squad.entity';
import { Session, SessionStatus } from '../sessions/entities/session.entity';
import { Invoice, InvoiceStatus } from '../finance/invoices/entities/invoice.entity';
import { Payment, PaymentStatus } from '../finance/payments/entities/payment.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Club } from '../clubs/entities/club.entity';
import { formatMoney, formatClubDate } from '../../common/region/format.util';
import { REGION_CONFIG } from '../../common/region/region.util';
import {
  DashboardStatsDto,
  MembershipStatsDto,
  RevenueStatsDto,
  AttendanceStatsDto,
  RecentActivityDto,
  UpcomingSessionDto,
  RevenueChartDataDto,
} from './dto/dashboard-stats.dto';
import { AttendanceStatus } from '../attendance/entities/attendance.entity';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    @InjectRepository(Family)
    private readonly familyRepository: Repository<Family>,
    @InjectRepository(Squad)
    private readonly squadRepository: Repository<Squad>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Club)
    private readonly clubRepository: Repository<Club>,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Resolve the current tenant's club so its currency, locale and timezone can
   * drive money and date formatting. Falls back to the GB defaults, so a club
   * with the default region settings (every existing UK club) is unaffected.
   */
  private async getClubRegion(): Promise<{
    currency: string;
    locale: string;
    timezone: string;
  }> {
    const club = await this.clubRepository.findOne({
      where: { id: this.tenantContext.getClubId() },
    });
    const defaults = REGION_CONFIG.GB;
    return {
      currency: club?.currency ?? defaults.currency,
      locale: club?.locale ?? defaults.locale,
      timezone: club?.timezone ?? defaults.defaultTimezone,
    };
  }

  async getDashboardStats(): Promise<DashboardStatsDto> {
    this.logger.log('Generating dashboard statistics');

    const [membership, revenue, attendance, recentActivity, upcomingSessions, revenueChart] =
      await Promise.all([
        this.getMembershipStats(),
        this.getRevenueStats(),
        this.getAttendanceStats(),
        this.getRecentActivity(),
        this.getUpcomingSessions(),
        this.getRevenueChartData(),
      ]);

    return {
      membership,
      revenue,
      attendance,
      recentActivity,
      upcomingSessions,
      revenueChart,
    };
  }

  async getReportsData() {
    this.logger.log('Generating reports data');

    const [
      weeklyAttendanceTrend,
      squadAttendanceRates,
      topAbsentees,
      newJoiners,
      squadDistribution,
    ] = await Promise.all([
      this.getWeeklyAttendanceTrend(),
      this.getSquadAttendanceRates(),
      this.getTopAbsentees(),
      this.getNewJoiners(),
      this.getSquadDistribution(),
    ]);

    return {
      weeklyAttendanceTrend,
      squadAttendanceRates,
      topAbsentees,
      newJoiners,
      leavers: [] as Array<{
        memberId: string;
        name: string;
        squadName: string;
        leftAt: string;
      }>,
      squadDistribution,
    };
  }

  private async getWeeklyAttendanceTrend(): Promise<Array<{ label: string; rate: number }>> {
    const weeks: Array<{ label: string; rate: number }> = [];

    for (let i = 7; i >= 0; i--) {
      const now = new Date();
      // Start of the target week (Monday)
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentMonday = new Date(now);
      currentMonday.setDate(now.getDate() - mondayOffset);
      currentMonday.setHours(0, 0, 0, 0);

      const weekStart = new Date(currentMonday);
      weekStart.setDate(currentMonday.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      // Get completed sessions in this week
      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.squad', 'squad')
        .leftJoinAndSelect('squad.members', 'members')
        .where('session.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
        .andWhere('session.session_date >= :weekStart', { weekStart })
        .andWhere('session.session_date < :weekEnd', { weekEnd })
        .andWhere('session.status = :status', {
          status: SessionStatus.COMPLETED,
        })
        .getMany();

      if (sessions.length === 0) {
        weeks.push({ label: `Wk ${8 - i}`, rate: 0 });
        continue;
      }

      const totalExpected = sessions.reduce((sum, s) => sum + (s.squad?.members?.length || 0), 0);

      const presentCount = await this.attendanceRepository
        .createQueryBuilder('attendance')
        .innerJoin('attendance.session', 'session')
        .where('attendance.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
        .andWhere('session.session_date >= :weekStart', { weekStart })
        .andWhere('session.session_date < :weekEnd', { weekEnd })
        .andWhere('session.status = :sessionStatus', {
          sessionStatus: SessionStatus.COMPLETED,
        })
        .andWhere('attendance.status = :attendanceStatus', {
          attendanceStatus: AttendanceStatus.PRESENT,
        })
        .getCount();

      const rate =
        totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100 * 100) / 100 : 0;

      weeks.push({ label: `Wk ${8 - i}`, rate });
    }

    return weeks;
  }

  private async getSquadAttendanceRates(): Promise<
    Array<{ squadId: string; squadName: string; attendanceRate: number }>
  > {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const squads = await this.squadRepository.find({
      where: { club_id: this.tenantContext.getClubId() },
      relations: ['members'],
    });

    const results: Array<{
      squadId: string;
      squadName: string;
      attendanceRate: number;
    }> = [];

    for (const squad of squads) {
      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .where('session.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
        .andWhere('session.squad_id = :squadId', { squadId: squad.squad_id })
        .andWhere('session.session_date >= :firstDayOfMonth', {
          firstDayOfMonth,
        })
        .andWhere('session.status = :status', {
          status: SessionStatus.COMPLETED,
        })
        .getMany();

      if (sessions.length === 0) {
        results.push({
          squadId: squad.squad_id,
          squadName: squad.squad_name,
          attendanceRate: 0,
        });
        continue;
      }

      const totalExpected = sessions.length * (squad.members?.length || 0);
      const sessionIds = sessions.map((s) => s.session_id);

      let presentCount = 0;
      if (sessionIds.length > 0 && totalExpected > 0) {
        presentCount = await this.attendanceRepository
          .createQueryBuilder('attendance')
          .where('attendance.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
          .andWhere('attendance.session_id IN (:...sessionIds)', { sessionIds })
          .andWhere('attendance.status = :status', {
            status: AttendanceStatus.PRESENT,
          })
          .getCount();
      }

      const rate =
        totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100 * 100) / 100 : 0;

      results.push({
        squadId: squad.squad_id,
        squadName: squad.squad_name,
        attendanceRate: rate,
      });
    }

    return results;
  }

  private async getTopAbsentees(): Promise<
    Array<{
      memberId: string;
      name: string;
      squadName: string;
      missedCount: number;
    }>
  > {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const absentees = await this.attendanceRepository
      .createQueryBuilder('attendance')
      .select('attendance.member_id', 'memberId')
      .addSelect('COUNT(*)', 'missedCount')
      .innerJoin('attendance.session', 'session')
      .where('attendance.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
      .andWhere('attendance.status = :status', {
        status: AttendanceStatus.ABSENT,
      })
      .andWhere('session.session_date >= :firstDayOfMonth', {
        firstDayOfMonth,
      })
      .andWhere('session.status = :sessionStatus', {
        sessionStatus: SessionStatus.COMPLETED,
      })
      .groupBy('attendance.member_id')
      .orderBy('"missedCount"', 'DESC')
      .limit(5)
      .getRawMany();

    const results: Array<{
      memberId: string;
      name: string;
      squadName: string;
      missedCount: number;
    }> = [];

    for (const row of absentees) {
      const member = await this.memberRepository.findOne({
        where: { member_id: row.memberId, club_id: this.tenantContext.getClubId() },
      });

      let squadName = 'Unassigned';
      if (member?.squad_id) {
        const squad = await this.squadRepository.findOne({
          where: { squad_id: member.squad_id, club_id: this.tenantContext.getClubId() },
        });
        if (squad) squadName = squad.squad_name;
      }

      results.push({
        memberId: row.memberId,
        name: member ? `${member.first_name} ${member.last_name}` : 'Unknown',
        squadName,
        missedCount: parseInt(row.missedCount, 10),
      });
    }

    return results;
  }

  private async getNewJoiners(): Promise<
    Array<{
      memberId: string;
      name: string;
      squadName: string;
      joinedAt: string;
    }>
  > {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const members = await this.memberRepository
      .createQueryBuilder('member')
      .where('member.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
      .andWhere('member.created_at >= :firstDayOfMonth', { firstDayOfMonth })
      .orderBy('member.created_at', 'DESC')
      .getMany();

    const results: Array<{
      memberId: string;
      name: string;
      squadName: string;
      joinedAt: string;
    }> = [];

    for (const member of members) {
      let squadName = 'Unassigned';
      if (member.squad_id) {
        const squad = await this.squadRepository.findOne({
          where: { squad_id: member.squad_id, club_id: this.tenantContext.getClubId() },
        });
        if (squad) squadName = squad.squad_name;
      }

      results.push({
        memberId: member.member_id,
        name: `${member.first_name} ${member.last_name}`,
        squadName,
        joinedAt: member.created_at.toISOString(),
      });
    }

    return results;
  }

  private async getSquadDistribution(): Promise<
    Array<{ squadId: string; squadName: string; memberCount: number }>
  > {
    const squads = await this.squadRepository
      .createQueryBuilder('squad')
      .loadRelationCountAndMap('squad.memberCount', 'squad.members')
      .where('squad.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
      .getMany();

    return squads.map((squad) => ({
      squadId: squad.squad_id,
      squadName: squad.squad_name,
      memberCount: ((squad as Record<string, unknown> & typeof squad).memberCount as number) || 0,
    }));
  }

  private async getMembershipStats(): Promise<MembershipStatsDto> {
    const clubId = this.tenantContext.getClubId();
    const [totalMembers, totalFamilies, totalSquads] = await Promise.all([
      this.memberRepository.count({ where: { club_id: clubId } }),
      this.familyRepository.count({ where: { club_id: clubId } }),
      this.squadRepository.count({ where: { club_id: clubId } }),
    ]);

    // For now, consider all members as active since there's no status field
    const activeMembers = totalMembers;

    return {
      totalMembers,
      activeMembers,
      totalFamilies,
      totalSquads,
    };
  }

  private async getRevenueStats(): Promise<RevenueStatsDto> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const clubId = this.tenantContext.getClubId();

    // Total revenue from confirmed payments
    const totalRevenueResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.club_id = :clubId', { clubId })
      .andWhere('payment.status = :status', { status: PaymentStatus.CONFIRMED })
      .getRawOne();

    // Monthly revenue
    const monthlyRevenueResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.club_id = :clubId', { clubId })
      .andWhere('payment.status = :status', { status: PaymentStatus.CONFIRMED })
      .andWhere('payment.payment_date >= :startDate', {
        startDate: firstDayOfMonth,
      })
      .getRawOne();

    // Outstanding invoices
    const outstandingResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total_amount)', 'total')
      .where('invoice.club_id = :clubId', { clubId })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
      })
      .getRawOne();

    // Total invoiced amount for collection rate
    const totalInvoicedResult = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('SUM(invoice.total_amount)', 'total')
      .where('invoice.club_id = :clubId', { clubId })
      .getRawOne();

    const totalRevenue = parseFloat(totalRevenueResult?.total || '0');
    const monthlyRevenue = parseFloat(monthlyRevenueResult?.total || '0');
    const outstandingAmount = parseFloat(outstandingResult?.total || '0');
    const totalInvoiced = parseFloat(totalInvoicedResult?.total || '0');

    const collectionRate = totalInvoiced > 0 ? (totalRevenue / totalInvoiced) * 100 : 0;

    return {
      totalRevenue,
      monthlyRevenue,
      outstandingAmount,
      collectionRate: Math.round(collectionRate * 100) / 100,
    };
  }

  private async getAttendanceStats(): Promise<AttendanceStatsDto> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const clubId = this.tenantContext.getClubId();

    // Count sessions in last 30 days
    const totalSessions = await this.sessionRepository
      .createQueryBuilder('session')
      .where('session.club_id = :clubId', { clubId })
      .andWhere('session.session_date > :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('session.status = :status', { status: SessionStatus.COMPLETED })
      .getCount();

    // Get attendance records for completed sessions in last 30 days
    const attendanceRecords = await this.attendanceRepository
      .createQueryBuilder('attendance')
      .innerJoin('attendance.session', 'session')
      .where('attendance.club_id = :clubId', { clubId })
      .andWhere('session.session_date > :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .andWhere('attendance.status = :attendanceStatus', {
        attendanceStatus: 'present',
      })
      .getCount();

    const averageAttendance = totalSessions > 0 ? attendanceRecords / totalSessions : 0;

    // Calculate attendance rate
    // Get total expected attendees (squad sizes) vs actual attendance
    const sessionsWithSquads = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.squad', 'squad')
      .leftJoinAndSelect('squad.members', 'members')
      .where('session.club_id = :clubId', { clubId })
      .andWhere('session.session_date > :thirtyDaysAgo', { thirtyDaysAgo })
      .andWhere('session.status = :status', {
        status: SessionStatus.COMPLETED,
      })
      .getMany();

    const totalExpectedAttendees = sessionsWithSquads.reduce(
      (sum, session) => sum + (session.squad?.members?.length || 0),
      0,
    );

    const attendanceRate =
      totalExpectedAttendees > 0 ? (attendanceRecords / totalExpectedAttendees) * 100 : 0;

    return {
      totalSessions,
      averageAttendance: Math.round(averageAttendance * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100) / 100,
    };
  }

  private async getRecentActivity(): Promise<RecentActivityDto[]> {
    const activities: RecentActivityDto[] = [];
    const clubId = this.tenantContext.getClubId();
    const { currency, locale } = await this.getClubRegion();

    // Recent invoices (last 10)
    const recentInvoices = await this.invoiceRepository.find({
      where: { club_id: clubId },
      order: { created_at: 'DESC' },
      take: 5,
      relations: ['family'],
    });

    recentInvoices.forEach((invoice) => {
      activities.push({
        id: invoice.invoice_id,
        type: 'invoice',
        description: `Invoice ${invoice.invoice_number} created for ${invoice.family?.family_name || 'Unknown'}`,
        timestamp: invoice.created_at,
        metadata: {
          amount: invoice.total_amount,
          status: invoice.status,
        },
      });
    });

    // Recent payments (last 10)
    const recentPayments = await this.paymentRepository.find({
      where: { club_id: clubId },
      order: { payment_date: 'DESC' },
      take: 5,
      relations: ['invoice', 'invoice.family'],
    });

    recentPayments.forEach((payment) => {
      activities.push({
        id: payment.payment_id,
        type: 'payment',
        description: `Payment received from ${payment.invoice?.family?.family_name || 'Unknown'} - ${formatMoney(payment.amount, currency, locale)}`,
        timestamp: payment.payment_date,
        metadata: {
          amount: payment.amount,
          method: payment.payment_method,
          status: payment.status,
        },
      });
    });

    // Recent members (last 5)
    const recentMembers = await this.memberRepository.find({
      where: { club_id: clubId },
      order: { created_at: 'DESC' },
      take: 3,
    });

    recentMembers.forEach((member) => {
      activities.push({
        id: member.member_id,
        type: 'member',
        description: `New member registered: ${member.first_name} ${member.last_name}`,
        timestamp: member.created_at,
      });
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 10);
  }

  private async getUpcomingSessions(): Promise<UpcomingSessionDto[]> {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const sessions = await this.sessionRepository
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.squad', 'squad')
      .leftJoinAndSelect('squad.members', 'members')
      .where('session.club_id = :clubId', { clubId: this.tenantContext.getClubId() })
      .andWhere('session.session_date >= :now', { now })
      .andWhere('session.session_date <= :sevenDays', {
        sevenDays: sevenDaysFromNow,
      })
      .andWhere('session.status = :status', { status: SessionStatus.SCHEDULED })
      .orderBy('session.session_date', 'ASC')
      .addOrderBy('session.start_time', 'ASC')
      .take(10)
      .getMany();

    return sessions.map((session) => {
      // Combine session_date and start_time/end_time into Date objects
      const sessionDate = new Date(session.session_date);
      const [startHours, startMinutes] = session.start_time.split(':').map(Number);
      const [endHours, endMinutes] = session.end_time.split(':').map(Number);

      const startDateTime = new Date(sessionDate);
      startDateTime.setHours(startHours, startMinutes);

      const endDateTime = new Date(sessionDate);
      endDateTime.setHours(endHours, endMinutes);

      return {
        session_id: session.session_id,
        squad_name: session.squad?.squad_name || 'Unknown Squad',
        start_time: startDateTime,
        end_time: endDateTime,
        location: session.location,
        expected_attendees: session.squad?.members?.length || 0,
      };
    });
  }

  private async getRevenueChartData(): Promise<RevenueChartDataDto[]> {
    const monthsToShow = 6;
    const chartData: RevenueChartDataDto[] = [];
    const clubId = this.tenantContext.getClubId();
    const { locale } = await this.getClubRegion();

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      // The label is a month bucket, not a true instant. Build it at UTC midday
      // and format it in UTC (see below) so the displayed month never shifts
      // across a timezone boundary for clubs east or west of UTC.
      const labelDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1, 12));

      // Get invoiced amount
      const invoicedResult = await this.invoiceRepository
        .createQueryBuilder('invoice')
        .select('SUM(invoice.total_amount)', 'total')
        .where('invoice.club_id = :clubId', { clubId })
        .andWhere('invoice.issued_date >= :firstDay', { firstDay })
        .andWhere('invoice.issued_date <= :lastDay', { lastDay })
        .getRawOne();

      // Get collected amount
      const collectedResult = await this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .where('payment.club_id = :clubId', { clubId })
        .andWhere('payment.payment_date >= :firstDay', { firstDay })
        .andWhere('payment.payment_date <= :lastDay', { lastDay })
        .andWhere('payment.status = :status', {
          status: PaymentStatus.CONFIRMED,
        })
        .getRawOne();

      const invoiced = parseFloat(invoicedResult?.total || '0');
      const collected = parseFloat(collectedResult?.total || '0');

      chartData.push({
        month: formatClubDate(labelDate, locale, 'UTC', {
          month: 'short',
          year: 'numeric',
        }),
        revenue: collected,
        invoiced,
        collected,
      });
    }

    return chartData;
  }
}
