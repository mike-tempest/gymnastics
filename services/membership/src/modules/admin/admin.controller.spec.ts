import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ClubSettingsService } from './settings/club-settings.service';
import { UserRole } from '../users/entities/user.entity';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: Record<string, jest.Mock>;
  let clubSettingsService: Record<string, jest.Mock>;

  const mockDashboardStats = {
    membership: {
      totalSwimmers: 10,
      activeSwimmers: 10,
      totalFamilies: 5,
      totalSquads: 2,
    },
    revenue: {
      totalRevenue: 1000,
      monthlyRevenue: 200,
      outstandingAmount: 50,
      collectionRate: 95,
    },
    attendance: {
      totalSessions: 20,
      averageAttendance: 8,
      attendanceRate: 80,
    },
    recentActivity: [],
    upcomingSessions: [],
    revenueChart: [],
  };

  const mockReportsData = {
    weeklyAttendanceTrend: [],
    squadAttendanceRates: [],
    topAbsentees: [],
    newJoiners: [],
    leavers: [],
    squadDistribution: [],
  };

  const mockSettings = {
    settings_id: 'set-1',
    club_name: 'Test Swimming Club',
    address: '123 Pool Lane',
    contact_email: 'admin@testclub.co.uk',
    locations: [],
    notification_prefs: {},
    swim_england: {},
    billing_config: {},
  };

  beforeEach(async () => {
    adminService = {
      getDashboardStats: jest.fn().mockResolvedValue(mockDashboardStats),
      getReportsData: jest.fn().mockResolvedValue(mockReportsData),
    };

    clubSettingsService = {
      getSettings: jest.fn().mockResolvedValue(mockSettings),
      updateSettings: jest.fn().mockResolvedValue(mockSettings),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: ClubSettingsService, useValue: clubSettingsService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('@Roles decorator', () => {
    it('should have SUPER_ADMIN role applied at class level', () => {
      const roles = Reflect.getMetadata('roles', AdminController);
      expect(roles).toContain(UserRole.SUPER_ADMIN);
    });
  });

  describe('GET /admin/dashboard', () => {
    it('should call adminService.getDashboardStats and return the result', async () => {
      const result = await controller.getDashboard();

      expect(adminService.getDashboardStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockDashboardStats);
    });
  });

  describe('GET /admin/reports', () => {
    it('should call adminService.getReportsData and return the result', async () => {
      const result = await controller.getReports();

      expect(adminService.getReportsData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockReportsData);
    });
  });

  describe('GET /admin/settings', () => {
    it('should call clubSettingsService.getSettings and return the result', async () => {
      const result = await controller.getSettings();

      expect(clubSettingsService.getSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSettings);
    });
  });

  describe('PUT /admin/settings', () => {
    it('should call clubSettingsService.updateSettings with the provided dto', async () => {
      const dto = { club_name: 'Updated Swimming Club' };
      const updatedSettings = { ...mockSettings, club_name: 'Updated Swimming Club' };
      clubSettingsService.updateSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateSettings(dto);

      expect(clubSettingsService.updateSettings).toHaveBeenCalledTimes(1);
      expect(clubSettingsService.updateSettings).toHaveBeenCalledWith(dto);
      expect(result).toEqual(updatedSettings);
    });
  });
});
