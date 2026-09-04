import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let _repository: AttendanceRepository;

  const mockAttendance: Partial<Attendance> = {
    attendance_id: '123e4567-e89b-12d3-a456-426614174000',
    session_id: '223e4567-e89b-12d3-a456-426614174001',
    swimmer_id: '334e5678-e89b-12d3-a456-426614174002',
    status: AttendanceStatus.PRESENT,
    checked_in_at: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySession: jest.fn(),
    findBySwimmer: jest.fn(),
    findBySessionAndSwimmer: jest.fn(),
    getAttendanceStats: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttendanceService, { provide: AttendanceRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    _repository = module.get<AttendanceRepository>(AttendanceRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an attendance record', async () => {
      const createDto = {
        session_id: mockAttendance.session_id as string,
        swimmer_id: mockAttendance.swimmer_id as string,
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockAttendance);

      const result = await service.create(createDto);

      expect(result).toEqual(mockAttendance);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw ConflictException if attendance already exists for the swimmer and session', async () => {
      const createDto = {
        session_id: mockAttendance.session_id as string,
        swimmer_id: mockAttendance.swimmer_id as string,
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(mockAttendance);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on unique constraint violation from the database', async () => {
      const createDto = {
        session_id: mockAttendance.session_id as string,
        swimmer_id: mockAttendance.swimmer_id as string,
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('markAttendance', () => {
    it('should mark attendance for multiple swimmers', async () => {
      const sessionId = mockAttendance.session_id as string;
      const markDto = {
        swimmer_ids: ['swimmer-1', 'swimmer-2'],
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockAttendance);

      const result = await service.markAttendance(sessionId, markDto);

      expect(result).toHaveLength(2);
      expect(mockRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should update existing attendance records rather than creating duplicates', async () => {
      const sessionId = mockAttendance.session_id as string;
      const markDto = {
        swimmer_ids: ['swimmer-1'],
        status: AttendanceStatus.ABSENT,
      };

      const existingRecord = { ...mockAttendance, status: AttendanceStatus.PRESENT };
      const updatedRecord = { ...mockAttendance, status: AttendanceStatus.ABSENT };

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(existingRecord);
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.markAttendance(sessionId, markDto);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(AttendanceStatus.ABSENT);
      expect(mockRepository.update).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if swimmer_ids is empty', async () => {
      const sessionId = mockAttendance.session_id as string;
      const markDto = {
        swimmer_ids: [],
        status: AttendanceStatus.PRESENT,
      };

      await expect(service.markAttendance(sessionId, markDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkInSwimmer', () => {
    it('should create a new attendance record with PRESENT status when none exists', async () => {
      const sessionId = mockAttendance.session_id as string;
      const swimmerId = mockAttendance.swimmer_id as string;

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        ...mockAttendance,
        status: AttendanceStatus.PRESENT,
        checked_in_at: new Date(),
      });

      const result = await service.checkInSwimmer(sessionId, swimmerId);

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(mockRepository.create).toHaveBeenCalledWith({
        session_id: sessionId,
        swimmer_id: swimmerId,
        status: AttendanceStatus.PRESENT,
      });
    });

    it('should update an existing attendance record to PRESENT on check-in', async () => {
      const sessionId = mockAttendance.session_id as string;
      const swimmerId = mockAttendance.swimmer_id as string;
      const existingRecord = { ...mockAttendance, status: AttendanceStatus.ABSENT };
      const updatedRecord = {
        ...existingRecord,
        status: AttendanceStatus.PRESENT,
        checked_in_at: new Date(),
      };

      mockRepository.findBySessionAndSwimmer.mockResolvedValue(existingRecord);
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.checkInSwimmer(sessionId, swimmerId);

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(mockRepository.update).toHaveBeenCalledWith(
        existingRecord.attendance_id,
        expect.objectContaining({ status: AttendanceStatus.PRESENT }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all attendance records', async () => {
      mockRepository.findAll.mockResolvedValue([mockAttendance]);

      const result = await service.findAll();

      expect(result).toEqual([mockAttendance]);
    });
  });

  describe('findOne', () => {
    it('should return a single attendance record', async () => {
      mockRepository.findOne.mockResolvedValue(mockAttendance);

      const result = await service.findOne(mockAttendance.attendance_id as string);

      expect(result).toEqual(mockAttendance);
    });

    it('should throw NotFoundException if attendance record does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSessionAttendance', () => {
    it('should return all attendance records for a session', async () => {
      mockRepository.findBySession.mockResolvedValue([mockAttendance]);

      const result = await service.getSessionAttendance(mockAttendance.session_id as string);

      expect(result).toEqual([mockAttendance]);
      expect(mockRepository.findBySession).toHaveBeenCalledWith(mockAttendance.session_id);
    });
  });

  describe('getSwimmerAttendance', () => {
    it('should return all attendance records for a swimmer', async () => {
      mockRepository.findBySwimmer.mockResolvedValue([mockAttendance]);

      const result = await service.getSwimmerAttendance(mockAttendance.swimmer_id as string);

      expect(result).toEqual([mockAttendance]);
      expect(mockRepository.findBySwimmer).toHaveBeenCalledWith(mockAttendance.swimmer_id);
    });
  });

  describe('getSwimmerAttendanceStats', () => {
    it('should return attendance statistics for a swimmer', async () => {
      const mockStats = {
        total: 20,
        present: 18,
        absent: 1,
        late: 1,
        excused: 0,
        attendance_rate: 90,
      };

      mockRepository.getAttendanceStats.mockResolvedValue(mockStats);

      const result = await service.getSwimmerAttendanceStats(mockAttendance.swimmer_id as string);

      expect(result).toEqual(mockStats);
      expect(mockRepository.getAttendanceStats).toHaveBeenCalledWith(mockAttendance.swimmer_id);
    });
  });

  describe('update', () => {
    it('should update an attendance record', async () => {
      const updateDto = { status: AttendanceStatus.LATE };
      const updatedRecord = { ...mockAttendance, status: AttendanceStatus.LATE };

      mockRepository.findOne.mockResolvedValue(mockAttendance);
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.update(mockAttendance.attendance_id as string, updateDto);

      expect(result.status).toBe(AttendanceStatus.LATE);
    });

    it('should throw NotFoundException if attendance record does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { status: AttendanceStatus.LATE }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an attendance record', async () => {
      mockRepository.findOne.mockResolvedValue(mockAttendance);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockAttendance.attendance_id as string);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockAttendance.attendance_id);
    });

    it('should throw NotFoundException if attendance record does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
