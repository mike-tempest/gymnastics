import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { AttendanceStats } from './attendance.repository';

describe('AttendanceController', () => {
  let controller: AttendanceController;
  let _service: jest.Mocked<AttendanceService>;

  const mockAttendance = {
    attendance_id: '123e4567-e89b-12d3-a456-426614174000',
    session_id: '223e4567-e89b-12d3-a456-426614174001',
    swimmer_id: '334e5678-e89b-12d3-a456-426614174002',
    status: AttendanceStatus.PRESENT,
    checked_in_at: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockAttendanceService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    markAttendance: jest.fn(),
    checkInSwimmer: jest.fn(),
    getSessionAttendance: jest.fn(),
    getSwimmerAttendance: jest.fn(),
    getSwimmerAttendanceStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [{ provide: AttendanceService, useValue: mockAttendanceService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttendanceController>(AttendanceController);
    _service = module.get(AttendanceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call attendanceService.create and return the result', async () => {
      const createDto = {
        session_id: mockAttendance.session_id,
        swimmer_id: mockAttendance.swimmer_id,
        status: AttendanceStatus.PRESENT,
      };

      mockAttendanceService.create.mockResolvedValue(mockAttendance);

      const result = await controller.create(createDto as CreateAttendanceDto);

      expect(result).toEqual(mockAttendance);
      expect(mockAttendanceService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('markAttendance', () => {
    it('should call attendanceService.markAttendance with session_id and dto', async () => {
      const body = {
        session_id: mockAttendance.session_id,
        swimmer_ids: ['swimmer-1', 'swimmer-2'],
        status: AttendanceStatus.PRESENT,
      };

      mockAttendanceService.markAttendance.mockResolvedValue([mockAttendance]);

      const result = await controller.markAttendance(
        body as { session_id: string } & MarkAttendanceDto,
      );

      expect(result).toEqual([mockAttendance]);
      expect(mockAttendanceService.markAttendance).toHaveBeenCalledWith(body.session_id, {
        swimmer_ids: body.swimmer_ids,
        status: body.status,
      });
    });
  });

  describe('checkIn', () => {
    it('should call attendanceService.checkInSwimmer and return the result', async () => {
      const body = {
        session_id: mockAttendance.session_id,
        swimmer_id: mockAttendance.swimmer_id,
      };

      mockAttendanceService.checkInSwimmer.mockResolvedValue({
        ...mockAttendance,
        checked_in_at: new Date(),
      });

      const result = await controller.checkIn(body);

      expect(result).toBeDefined();
      expect(mockAttendanceService.checkInSwimmer).toHaveBeenCalledWith(
        body.session_id,
        body.swimmer_id,
      );
    });
  });

  describe('findAll', () => {
    it('should return all attendance records', async () => {
      mockAttendanceService.findAll.mockResolvedValue([mockAttendance]);

      const result = await controller.findAll();

      expect(result).toEqual([mockAttendance]);
    });
  });

  describe('getSessionAttendance', () => {
    it('should return attendance for a specific session', async () => {
      mockAttendanceService.getSessionAttendance.mockResolvedValue([mockAttendance]);

      const result = await controller.getSessionAttendance(mockAttendance.session_id);

      expect(result).toEqual([mockAttendance]);
      expect(mockAttendanceService.getSessionAttendance).toHaveBeenCalledWith(
        mockAttendance.session_id,
      );
    });
  });

  describe('getSwimmerAttendance', () => {
    it('should return attendance records for a specific swimmer', async () => {
      mockAttendanceService.getSwimmerAttendance.mockResolvedValue([mockAttendance]);

      const result = await controller.getSwimmerAttendance(mockAttendance.swimmer_id);

      expect(result).toEqual([mockAttendance]);
      expect(mockAttendanceService.getSwimmerAttendance).toHaveBeenCalledWith(
        mockAttendance.swimmer_id,
      );
    });
  });

  describe('getSwimmerStats', () => {
    it('should return attendance statistics for a swimmer', async () => {
      const mockStats = { total: 20, present: 18, absent: 1, late: 1, attendance_rate: 90 };
      mockAttendanceService.getSwimmerAttendanceStats.mockResolvedValue(
        mockStats as unknown as AttendanceStats,
      );

      const result = await controller.getSwimmerStats(mockAttendance.swimmer_id);

      expect(result).toEqual(mockStats);
    });
  });

  describe('findOne', () => {
    it('should return a single attendance record', async () => {
      mockAttendanceService.findOne.mockResolvedValue(mockAttendance);

      const result = await controller.findOne(mockAttendance.attendance_id);

      expect(result).toEqual(mockAttendance);
    });
  });

  describe('update', () => {
    it('should update an attendance record', async () => {
      const updateDto = { status: AttendanceStatus.LATE };
      const updated = { ...mockAttendance, status: AttendanceStatus.LATE };

      mockAttendanceService.update.mockResolvedValue(updated as unknown as Attendance);

      const result = await controller.update(
        mockAttendance.attendance_id,
        updateDto as UpdateAttendanceDto,
      );

      expect(result.status).toBe(AttendanceStatus.LATE);
    });
  });

  describe('remove', () => {
    it('should remove an attendance record', async () => {
      mockAttendanceService.remove.mockResolvedValue(undefined);

      await controller.remove(mockAttendance.attendance_id);

      expect(mockAttendanceService.remove).toHaveBeenCalledWith(mockAttendance.attendance_id);
    });
  });
});
