import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { Swimmer } from '../swimmers/entities/swimmer.entity';
import { Family } from '../families/entities/family.entity';
import { Squad } from '../squads/entities/squad.entity';
import { Session } from '../sessions/entities/session.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { Payment } from '../finance/payments/entities/payment.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Club } from '../clubs/entities/club.entity';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

const TEST_CLUB_ID = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function createMockQueryBuilder() {
  return {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
  };
}

function createMockRepository() {
  const qb = createMockQueryBuilder();
  return {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    __qb: qb,
  };
}

describe('AdminService', () => {
  let service: AdminService;
  let swimmerRepo: ReturnType<typeof createMockRepository>;
  let familyRepo: ReturnType<typeof createMockRepository>;
  let squadRepo: ReturnType<typeof createMockRepository>;
  let sessionRepo: ReturnType<typeof createMockRepository>;
  let invoiceRepo: ReturnType<typeof createMockRepository>;
  let paymentRepo: ReturnType<typeof createMockRepository>;
  let attendanceRepo: ReturnType<typeof createMockRepository>;
  let clubRepo: ReturnType<typeof createMockRepository>;

  beforeEach(async () => {
    swimmerRepo = createMockRepository();
    familyRepo = createMockRepository();
    squadRepo = createMockRepository();
    sessionRepo = createMockRepository();
    invoiceRepo = createMockRepository();
    paymentRepo = createMockRepository();
    attendanceRepo = createMockRepository();
    clubRepo = createMockRepository();
    // Default to a GB club so existing dashboard output is unchanged.
    clubRepo.findOne.mockResolvedValue({
      id: TEST_CLUB_ID,
      currency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Swimmer), useValue: swimmerRepo },
        { provide: getRepositoryToken(Family), useValue: familyRepo },
        { provide: getRepositoryToken(Squad), useValue: squadRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(Attendance), useValue: attendanceRepo },
        { provide: getRepositoryToken(Club), useValue: clubRepo },
        {
          provide: TenantContextService,
          useValue: { getClubId: jest.fn().mockReturnValue(TEST_CLUB_ID) },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats', () => {
    it('should return a stats object with the correct shape', async () => {
      const result = await service.getDashboardStats();

      expect(result).toHaveProperty('membership');
      expect(result).toHaveProperty('revenue');
      expect(result).toHaveProperty('attendance');
      expect(result).toHaveProperty('recentActivity');
      expect(result).toHaveProperty('upcomingSessions');
      expect(result).toHaveProperty('revenueChart');
    });

    it('should return membership stats from repositories', async () => {
      swimmerRepo.count.mockResolvedValue(25);
      familyRepo.count.mockResolvedValue(15);
      squadRepo.count.mockResolvedValue(4);

      const result = await service.getDashboardStats();

      expect(result.membership).toEqual({
        totalSwimmers: 25,
        activeSwimmers: 25,
        totalFamilies: 15,
        totalSquads: 4,
      });
    });

    it('should return revenue stats with zero values when no data exists', async () => {
      const result = await service.getDashboardStats();

      expect(result.revenue).toEqual({
        totalRevenue: 0,
        monthlyRevenue: 0,
        outstandingAmount: 0,
        collectionRate: 0,
      });
    });

    it('should return attendance stats with zero values when no sessions exist', async () => {
      const result = await service.getDashboardStats();

      expect(result.attendance).toEqual({
        totalSessions: 0,
        averageAttendance: 0,
        attendanceRate: 0,
      });
    });

    it('should return recent activity as an array', async () => {
      const result = await service.getDashboardStats();

      expect(Array.isArray(result.recentActivity)).toBe(true);
    });

    it('should return upcoming sessions as an array', async () => {
      const result = await service.getDashboardStats();

      expect(Array.isArray(result.upcomingSessions)).toBe(true);
    });

    it('should return revenue chart data as an array with 6 months', async () => {
      const result = await service.getDashboardStats();

      expect(Array.isArray(result.revenueChart)).toBe(true);
      expect(result.revenueChart).toHaveLength(6);
      for (const entry of result.revenueChart) {
        expect(entry).toHaveProperty('month');
        expect(entry).toHaveProperty('revenue');
        expect(entry).toHaveProperty('invoiced');
        expect(entry).toHaveProperty('collected');
      }
    });
  });

  describe('region-aware formatting', () => {
    const mockPayment = {
      payment_id: 'pay-1',
      amount: 1250.5,
      payment_date: new Date('2026-03-15'),
      payment_method: 'card',
      status: 'confirmed',
      invoice: { family: { family_name: 'Smith' } },
    };

    it('formats the payment description with £ for a GB club (unchanged UK output)', async () => {
      paymentRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.getDashboardStats();
      const paymentActivity = result.recentActivity.find((a) => a.type === 'payment');

      expect(paymentActivity?.description).toBe('Payment received from Smith - £1,250.50');
    });

    it('formats the payment description in the club currency for a non-GB club', async () => {
      clubRepo.findOne.mockResolvedValue({
        id: TEST_CLUB_ID,
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
      });
      paymentRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.getDashboardStats();
      const paymentActivity = result.recentActivity.find((a) => a.type === 'payment');

      expect(paymentActivity?.description).toBe('Payment received from Smith - $1,250.50');
    });

    it('labels revenue-chart months in the club locale for a non-GB club', async () => {
      clubRepo.findOne.mockResolvedValue({
        id: TEST_CLUB_ID,
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
      });

      const result = await service.getDashboardStats();

      // The month label is a bucket, not an instant: built at UTC midday and
      // formatted in UTC so it never shifts across a timezone boundary. Only
      // the locale varies by club.
      const now = new Date();
      const labelDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 12));
      const expected = labelDate.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        year: 'numeric',
      });
      const lastEntry = result.revenueChart[result.revenueChart.length - 1];
      expect(lastEntry.month).toBe(expected);
    });
  });

  describe('getReportsData', () => {
    it('should return a reports object with the correct shape', async () => {
      const result = await service.getReportsData();

      expect(result).toHaveProperty('weeklyAttendanceTrend');
      expect(result).toHaveProperty('squadAttendanceRates');
      expect(result).toHaveProperty('topAbsentees');
      expect(result).toHaveProperty('newJoiners');
      expect(result).toHaveProperty('leavers');
      expect(result).toHaveProperty('squadDistribution');
    });

    it('should return weekly attendance trend with 8 weeks of data', async () => {
      const result = await service.getReportsData();

      expect(result.weeklyAttendanceTrend).toHaveLength(8);
      for (const week of result.weeklyAttendanceTrend) {
        expect(week).toHaveProperty('label');
        expect(week).toHaveProperty('rate');
      }
    });

    it('should return squad attendance rates matching the number of squads', async () => {
      squadRepo.find.mockResolvedValue([
        { squad_id: 'sq-1', squad_name: 'Junior', swimmers: [] },
        { squad_id: 'sq-2', squad_name: 'Senior', swimmers: [] },
      ]);

      const result = await service.getReportsData();

      expect(result.squadAttendanceRates).toHaveLength(2);
      expect(result.squadAttendanceRates[0]).toHaveProperty('squadId');
      expect(result.squadAttendanceRates[0]).toHaveProperty('squadName');
      expect(result.squadAttendanceRates[0]).toHaveProperty('attendanceRate');
    });

    it('should return leavers as an empty array', async () => {
      const result = await service.getReportsData();

      expect(result.leavers).toEqual([]);
    });

    it('should return squad distribution from repository', async () => {
      squadRepo.createQueryBuilder.mockReturnValue({
        ...createMockQueryBuilder(),
        getMany: jest.fn().mockResolvedValue([
          { squad_id: 'sq-1', squad_name: 'Junior', swimmerCount: 10 },
          { squad_id: 'sq-2', squad_name: 'Senior', swimmerCount: 8 },
        ]),
      });

      const result = await service.getReportsData();

      expect(result.squadDistribution).toHaveLength(2);
      expect(result.squadDistribution[0]).toEqual({
        squadId: 'sq-1',
        squadName: 'Junior',
        swimmerCount: 10,
      });
    });
  });

  describe('edge case: zero data (division by zero)', () => {
    it('should not produce NaN or Infinity for collection rate when no invoices exist', async () => {
      const result = await service.getDashboardStats();

      expect(result.revenue.collectionRate).toBe(0);
      expect(Number.isFinite(result.revenue.collectionRate)).toBe(true);
    });

    it('should not produce NaN or Infinity for attendance rate when no sessions exist', async () => {
      const result = await service.getDashboardStats();

      expect(result.attendance.attendanceRate).toBe(0);
      expect(Number.isFinite(result.attendance.attendanceRate)).toBe(true);
    });

    it('should not produce NaN or Infinity for average attendance when no sessions exist', async () => {
      const result = await service.getDashboardStats();

      expect(result.attendance.averageAttendance).toBe(0);
      expect(Number.isFinite(result.attendance.averageAttendance)).toBe(true);
    });

    it('should handle zero weekly attendance data without errors', async () => {
      const result = await service.getReportsData();

      for (const week of result.weeklyAttendanceTrend) {
        expect(Number.isFinite(week.rate)).toBe(true);
      }
    });

    it('should handle squads with no swimmers for attendance rates', async () => {
      squadRepo.find.mockResolvedValue([
        { squad_id: 'sq-1', squad_name: 'Empty Squad', swimmers: [] },
      ]);

      const result = await service.getReportsData();

      expect(result.squadAttendanceRates[0].attendanceRate).toBe(0);
      expect(Number.isFinite(result.squadAttendanceRates[0].attendanceRate)).toBe(true);
    });
  });
});
