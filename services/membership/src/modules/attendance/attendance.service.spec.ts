import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { Attendance, AttendanceStatus } from './entities/attendance.entity';
import { MembersRepository } from '../members/members.repository';
import { SessionsRepository } from '../sessions/sessions.repository';
import { Member } from '../members/entities/member.entity';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let _repository: AttendanceRepository;

  const CLUB_ID = '994e5678-e89b-12d3-a456-426614174009';
  const SQUAD_ID = '884e5678-e89b-12d3-a456-426614174008';

  const mockAttendance: Partial<Attendance> = {
    attendance_id: '123e4567-e89b-12d3-a456-426614174000',
    session_id: '223e4567-e89b-12d3-a456-426614174001',
    member_id: '334e5678-e89b-12d3-a456-426614174002',
    status: AttendanceStatus.PRESENT,
    checked_in_at: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  /** A squad member, named so the roster's alphabetical order is testable. */
  function member(id: string, firstName: string, lastName: string): Member {
    return {
      member_id: id,
      club_id: CLUB_ID,
      squad_id: SQUAD_ID,
      first_name: firstName,
      last_name: lastName,
    } as Member;
  }

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findBySession: jest.fn(),
    findByMember: jest.fn(),
    findBySessionAndMember: jest.fn(),
    getAttendanceStats: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockMembersRepository = {
    findBySquadId: jest.fn(),
  };

  const mockSessionsRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: AttendanceRepository, useValue: mockRepository },
        { provide: MembersRepository, useValue: mockMembersRepository },
        { provide: SessionsRepository, useValue: mockSessionsRepository },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    _repository = module.get<AttendanceRepository>(AttendanceRepository);

    // Most tests do not care about the roster; default to a session with no
    // squad so they see only the attendance rows they set up.
    mockSessionsRepository.findOne.mockResolvedValue(null);
    mockMembersRepository.findBySquadId.mockResolvedValue([]);
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
        member_id: mockAttendance.member_id as string,
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndMember.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockAttendance);

      const result = await service.create(createDto);

      expect(result).toEqual(mockAttendance);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw ConflictException if attendance already exists for the member and session', async () => {
      const createDto = {
        session_id: mockAttendance.session_id as string,
        member_id: mockAttendance.member_id as string,
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndMember.mockResolvedValue(mockAttendance);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on unique constraint violation from the database', async () => {
      const createDto = {
        session_id: mockAttendance.session_id as string,
        member_id: mockAttendance.member_id as string,
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndMember.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue({ code: '23505' });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('markAttendance', () => {
    it('should mark attendance for multiple members', async () => {
      const sessionId = mockAttendance.session_id as string;
      const markDto = {
        member_ids: ['member-1', 'member-2'],
        status: AttendanceStatus.PRESENT,
      };

      mockRepository.findBySessionAndMember.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockAttendance);

      const result = await service.markAttendance(sessionId, markDto);

      expect(result).toHaveLength(2);
      expect(mockRepository.create).toHaveBeenCalledTimes(2);
    });

    it('should update existing attendance records rather than creating duplicates', async () => {
      const sessionId = mockAttendance.session_id as string;
      const markDto = {
        member_ids: ['member-1'],
        status: AttendanceStatus.ABSENT,
      };

      const existingRecord = { ...mockAttendance, status: AttendanceStatus.PRESENT };
      const updatedRecord = { ...mockAttendance, status: AttendanceStatus.ABSENT };

      mockRepository.findBySessionAndMember.mockResolvedValue(existingRecord);
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.markAttendance(sessionId, markDto);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(AttendanceStatus.ABSENT);
      expect(mockRepository.update).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if member_ids is empty', async () => {
      const sessionId = mockAttendance.session_id as string;
      const markDto = {
        member_ids: [],
        status: AttendanceStatus.PRESENT,
      };

      await expect(service.markAttendance(sessionId, markDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkInMember', () => {
    it('should create a new attendance record with PRESENT status when none exists', async () => {
      const sessionId = mockAttendance.session_id as string;
      const memberId = mockAttendance.member_id as string;

      mockRepository.findBySessionAndMember.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        ...mockAttendance,
        status: AttendanceStatus.PRESENT,
        checked_in_at: new Date(),
      });

      const result = await service.checkInMember(sessionId, memberId);

      expect(result.status).toBe(AttendanceStatus.PRESENT);
      expect(mockRepository.create).toHaveBeenCalledWith({
        session_id: sessionId,
        member_id: memberId,
        status: AttendanceStatus.PRESENT,
      });
    });

    it('should update an existing attendance record to PRESENT on check-in', async () => {
      const sessionId = mockAttendance.session_id as string;
      const memberId = mockAttendance.member_id as string;
      const existingRecord = { ...mockAttendance, status: AttendanceStatus.ABSENT };
      const updatedRecord = {
        ...existingRecord,
        status: AttendanceStatus.PRESENT,
        checked_in_at: new Date(),
      };

      mockRepository.findBySessionAndMember.mockResolvedValue(existingRecord);
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.checkInMember(sessionId, memberId);

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

  describe('getSessionRoster', () => {
    const SESSION_ID = mockAttendance.session_id as string;

    it('returns the attendance rows for a session with no squad', async () => {
      mockRepository.findBySession.mockResolvedValue([mockAttendance]);

      const result = await service.getSessionRoster(SESSION_ID);

      expect(result).toEqual([mockAttendance]);
      expect(mockRepository.findBySession).toHaveBeenCalledWith(SESSION_ID);
    });

    // The reason this method exists: a scheduled session has no attendance
    // rows, and a coach still has to be able to take its register.
    it('lists the squad as unmarked when the session has no attendance rows', async () => {
      mockSessionsRepository.findOne.mockResolvedValue({
        session_id: SESSION_ID,
        squad_id: SQUAD_ID,
      });
      mockMembersRepository.findBySquadId.mockResolvedValue([
        member('m-1', 'Amelia', 'Ashworth'),
        member('m-2', 'Ben', 'Brookes'),
      ]);
      mockRepository.findBySession.mockResolvedValue([]);

      const result = await service.getSessionRoster(SESSION_ID);

      expect(result).toHaveLength(2);
      expect(result.map((entry) => entry.member_id)).toEqual(['m-1', 'm-2']);
      for (const entry of result) {
        expect(entry.attendance_id).toBeNull();
        expect(entry.status).toBeNull();
        expect(entry.session_id).toBe(SESSION_ID);
      }
      expect(mockMembersRepository.findBySquadId).toHaveBeenCalledWith(SQUAD_ID);
    });

    it('writes nothing when building a roster for an unmarked session', async () => {
      mockSessionsRepository.findOne.mockResolvedValue({
        session_id: SESSION_ID,
        squad_id: SQUAD_ID,
      });
      mockMembersRepository.findBySquadId.mockResolvedValue([member('m-1', 'Amelia', 'Ashworth')]);
      mockRepository.findBySession.mockResolvedValue([]);

      await service.getSessionRoster(SESSION_ID);

      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('attaches existing rows and leaves the rest unmarked', async () => {
      const marked = { ...mockAttendance, member_id: 'm-2', status: AttendanceStatus.LATE };
      mockSessionsRepository.findOne.mockResolvedValue({
        session_id: SESSION_ID,
        squad_id: SQUAD_ID,
      });
      mockMembersRepository.findBySquadId.mockResolvedValue([
        member('m-1', 'Amelia', 'Ashworth'),
        member('m-2', 'Ben', 'Brookes'),
      ]);
      mockRepository.findBySession.mockResolvedValue([marked]);

      const result = await service.getSessionRoster(SESSION_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ member_id: 'm-1', attendance_id: null, status: null });
      expect(result[1]).toMatchObject({
        member_id: 'm-2',
        attendance_id: mockAttendance.attendance_id,
        status: AttendanceStatus.LATE,
      });
    });

    // A gymnast who changed squad after being marked must not vanish from the
    // register, which would silently drop a mark the coach already made.
    it('keeps a marked gymnast who is no longer in the squad', async () => {
      const departed = { ...mockAttendance, member_id: 'm-9' };
      mockSessionsRepository.findOne.mockResolvedValue({
        session_id: SESSION_ID,
        squad_id: SQUAD_ID,
      });
      mockMembersRepository.findBySquadId.mockResolvedValue([member('m-1', 'Amelia', 'Ashworth')]);
      mockRepository.findBySession.mockResolvedValue([departed]);

      const result = await service.getSessionRoster(SESSION_ID);

      expect(result.map((entry) => entry.member_id).sort()).toEqual(['m-1', 'm-9']);
    });

    it('orders the register by name', async () => {
      mockSessionsRepository.findOne.mockResolvedValue({
        session_id: SESSION_ID,
        squad_id: SQUAD_ID,
      });
      mockMembersRepository.findBySquadId.mockResolvedValue([
        member('m-3', 'Zoe', 'Ashworth'),
        member('m-1', 'Amelia', 'Ashworth'),
        member('m-2', 'Ben', 'Abbott'),
      ]);
      mockRepository.findBySession.mockResolvedValue([]);

      const result = await service.getSessionRoster(SESSION_ID);

      expect(result.map((entry) => entry.member_id)).toEqual(['m-2', 'm-1', 'm-3']);
    });

    // Tenant scoping lives in the repositories: a session from another club
    // resolves to null there, which must leave an empty register rather than
    // falling through to some other club's squad.
    it('returns an empty register for a session the tenant cannot see', async () => {
      mockSessionsRepository.findOne.mockResolvedValue(null);
      mockRepository.findBySession.mockResolvedValue([]);

      const result = await service.getSessionRoster('not-this-club');

      expect(result).toEqual([]);
      expect(mockMembersRepository.findBySquadId).not.toHaveBeenCalled();
    });
  });

  describe('getMemberAttendance', () => {
    it('should return all attendance records for a member', async () => {
      mockRepository.findByMember.mockResolvedValue([mockAttendance]);

      const result = await service.getMemberAttendance(mockAttendance.member_id as string);

      expect(result).toEqual([mockAttendance]);
      expect(mockRepository.findByMember).toHaveBeenCalledWith(mockAttendance.member_id);
    });
  });

  describe('getMemberAttendanceStats', () => {
    it('should return attendance statistics for a member', async () => {
      const mockStats = {
        total: 20,
        present: 18,
        absent: 1,
        late: 1,
        excused: 0,
        attendance_rate: 90,
      };

      mockRepository.getAttendanceStats.mockResolvedValue(mockStats);

      const result = await service.getMemberAttendanceStats(mockAttendance.member_id as string);

      expect(result).toEqual(mockStats);
      expect(mockRepository.getAttendanceStats).toHaveBeenCalledWith(mockAttendance.member_id);
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
