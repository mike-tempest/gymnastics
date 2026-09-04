import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { EmailService } from '../email/email.service';
import { SwimmersRepository } from '../swimmers/swimmers.repository';
import { FamiliesRepository } from '../families/families.repository';
import { ClubsRepository } from '../clubs/clubs.repository';
import { Club } from '../clubs/entities/club.entity';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

/**
 * Test seam over SessionsService that lets specs pin the wall clock, so the
 * per-timezone reminder selection can be asserted deterministically.
 */
class TestableSessionsService extends SessionsService {
  public fakeNow = new Date();
  protected now(): Date {
    return this.fakeNow;
  }
}

describe('SessionsService', () => {
  let service: TestableSessionsService;
  let _repository: SessionsRepository;

  const mockSession: Partial<Session> = {
    session_id: '123e4567-e89b-12d3-a456-426614174000',
    session_name: 'Morning Training',
    session_date: new Date('2026-03-15'),
    start_time: '09:00',
    end_time: '10:00',
    location: 'Main Pool',
    status: SessionStatus.SCHEDULED,
    squad_id: '223e4567-e89b-12d3-a456-426614174001',
    coach_name: 'Sarah Jones',
    description: 'Regular morning session',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findUpcoming: jest.fn(),
    findBySquad: jest.fn(),
    findByDateRange: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    findSessionsForRemindersBetween: jest.fn(),
    findRecentBetween: jest.fn(),
    attendanceCountsBySession: jest.fn(),
  };

  const mockEmailService = {
    sendSessionReminder: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  };

  const mockSwimmersRepository = {
    findOne: jest.fn(),
  };

  const mockFamiliesRepository = {
    findOne: jest.fn(),
  };

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  const mockTenantContext = {
    getClubId: jest.fn().mockReturnValue('club-uuid-1'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestableSessionsService,
        { provide: SessionsRepository, useValue: mockRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SwimmersRepository, useValue: mockSwimmersRepository },
        { provide: FamiliesRepository, useValue: mockFamiliesRepository },
        { provide: ClubsRepository, useValue: mockClubsRepository },
        { provide: TenantContextService, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<TestableSessionsService>(TestableSessionsService);
    _repository = module.get<SessionsRepository>(SessionsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const createDto = {
        session_name: 'Morning Training',
        session_date: new Date('2026-03-15'),
        start_time: '09:00',
        end_time: '10:00',
      };

      mockRepository.create.mockResolvedValue(mockSession);

      const result = await service.create(createDto as unknown as CreateSessionDto);

      expect(result).toEqual(mockSession);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw BadRequestException if start_time is after end_time', async () => {
      const createDto = {
        session_name: 'Invalid Session',
        session_date: new Date('2026-03-15'),
        start_time: '11:00',
        end_time: '09:00',
      };

      await expect(service.create(createDto as unknown as CreateSessionDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if start_time equals end_time', async () => {
      const createDto = {
        session_name: 'Zero Duration',
        session_date: new Date('2026-03-15'),
        start_time: '10:00',
        end_time: '10:00',
      };

      await expect(service.create(createDto as unknown as CreateSessionDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all sessions', async () => {
      mockRepository.findAll.mockResolvedValue([mockSession]);

      const result = await service.findAll();

      expect(result).toEqual([mockSession]);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should return an empty array when no sessions exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single session', async () => {
      mockRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.findOne(mockSession.session_id as string);

      expect(result).toEqual(mockSession);
      expect(mockRepository.findOne).toHaveBeenCalledWith(mockSession.session_id);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUpcomingSessions', () => {
    it('should return upcoming sessions', async () => {
      mockRepository.findUpcoming.mockResolvedValue([mockSession]);

      const result = await service.getUpcomingSessions(5);

      expect(result).toEqual([mockSession]);
      expect(mockRepository.findUpcoming).toHaveBeenCalledWith(5);
    });

    it('should return upcoming sessions without a limit', async () => {
      mockRepository.findUpcoming.mockResolvedValue([mockSession]);

      const result = await service.getUpcomingSessions();

      expect(result).toEqual([mockSession]);
      expect(mockRepository.findUpcoming).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getRecentSessions', () => {
    const recentSessionA = { ...mockSession, session_id: 'session-a' };
    const recentSessionB = { ...mockSession, session_id: 'session-b' };

    beforeEach(() => {
      mockClubsRepository.findOne.mockResolvedValue({ timezone: 'Europe/London' } as Club);
      mockRepository.findRecentBetween.mockResolvedValue([recentSessionA, recentSessionB]);
      mockRepository.attendanceCountsBySession.mockResolvedValue([
        { session_id: 'session-a', total: '10', attended: '8' },
      ]);
    });

    it('queries the last 7 club-local calendar days inclusive of today', async () => {
      service.fakeNow = new Date('2026-08-04T12:00:00Z');

      await service.getRecentSessions();

      expect(mockRepository.findRecentBetween).toHaveBeenCalledWith('2026-07-29', '2026-08-04');
    });

    it('resolves today in the club timezone, not server time', async () => {
      // 23:30 UTC on the 4th is already the 5th in Sydney.
      mockClubsRepository.findOne.mockResolvedValue({ timezone: 'Australia/Sydney' } as Club);
      service.fakeNow = new Date('2026-08-04T23:30:00Z');

      await service.getRecentSessions();

      expect(mockRepository.findRecentBetween).toHaveBeenCalledWith('2026-07-30', '2026-08-05');
    });

    it('resolves today in the club timezone when local date lags UTC', async () => {
      // 02:00 UTC on the 5th is still the 4th in New York.
      mockClubsRepository.findOne.mockResolvedValue({ timezone: 'America/New_York' } as Club);
      service.fakeNow = new Date('2026-08-05T02:00:00Z');

      await service.getRecentSessions();

      expect(mockRepository.findRecentBetween).toHaveBeenCalledWith('2026-07-29', '2026-08-04');
    });

    it('merges register totals and zero-fills sessions with no register', async () => {
      service.fakeNow = new Date('2026-08-04T12:00:00Z');

      const result = await service.getRecentSessions();

      expect(result[0]).toMatchObject({
        session_id: 'session-a',
        attendance_count: 8,
        total_swimmers: 10,
      });
      expect(result[1]).toMatchObject({
        session_id: 'session-b',
        attendance_count: 0,
        total_swimmers: 0,
      });
    });

    it('clamps the window to a sane range', async () => {
      service.fakeNow = new Date('2026-08-04T12:00:00Z');

      await service.getRecentSessions(500);

      expect(mockRepository.findRecentBetween).toHaveBeenCalledWith('2026-07-05', '2026-08-04');
    });
  });

  describe('getSessionsBySquad', () => {
    it('should return sessions for a specific squad', async () => {
      mockRepository.findBySquad.mockResolvedValue([mockSession]);

      const result = await service.getSessionsBySquad(mockSession.squad_id as string);

      expect(result).toEqual([mockSession]);
      expect(mockRepository.findBySquad).toHaveBeenCalledWith(mockSession.squad_id);
    });
  });

  describe('getSessionsByDateRange', () => {
    it('should return sessions within the specified date range', async () => {
      const start = new Date('2026-03-01');
      const end = new Date('2026-03-31');

      mockRepository.findByDateRange.mockResolvedValue([mockSession]);

      const result = await service.getSessionsByDateRange(start, end);

      expect(result).toEqual([mockSession]);
      expect(mockRepository.findByDateRange).toHaveBeenCalledWith(start, end);
    });

    it('should throw BadRequestException if startDate is after endDate', async () => {
      const start = new Date('2026-03-31');
      const end = new Date('2026-03-01');

      await expect(service.getSessionsByDateRange(start, end)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSessionStatus', () => {
    it('should update the status of a session', async () => {
      const updatedSession = { ...mockSession, status: SessionStatus.COMPLETED };

      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.update.mockResolvedValue(updatedSession);

      const result = await service.updateSessionStatus(
        mockSession.session_id as string,
        SessionStatus.COMPLETED,
      );

      expect(result.status).toBe(SessionStatus.COMPLETED);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateSessionStatus('non-existent-id', SessionStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for an invalid status value', async () => {
      mockRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.updateSessionStatus(
          mockSession.session_id as string,
          'invalid_status' as unknown as SessionStatus,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update a session', async () => {
      const updateDto = { session_name: 'Evening Training' };
      const updatedSession = { ...mockSession, session_name: 'Evening Training' };

      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.update.mockResolvedValue(updatedSession);

      const result = await service.update(
        mockSession.session_id as string,
        updateDto as UpdateSessionDto,
      );

      expect(result.session_name).toBe('Evening Training');
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { session_name: 'Test' } as UpdateSessionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if updated time range is invalid', async () => {
      const updateDto = { start_time: '10:00', end_time: '09:00' };

      mockRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.update(mockSession.session_id as string, updateDto as UpdateSessionDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate new start_time against existing end_time', async () => {
      const updateDto = { start_time: '11:00' };

      mockRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.update(mockSession.session_id as string, updateDto as UpdateSessionDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate new end_time against existing start_time', async () => {
      const updateDto = { end_time: '08:00' };

      mockRepository.findOne.mockResolvedValue(mockSession);

      await expect(
        service.update(mockSession.session_id as string, updateDto as UpdateSessionDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a session', async () => {
      mockRepository.findOne.mockResolvedValue(mockSession);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockSession.session_id as string);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockSession.session_id);
    });

    it('should throw NotFoundException if session does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should return session statistics', async () => {
      mockRepository.count.mockResolvedValue(12);

      const result = await service.getStatistics();

      expect(result).toEqual({ total: 12 });
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });

  describe('sendSessionReminders (timezone-aware)', () => {
    const gbClub: Partial<Club> = {
      id: 'club-gb',
      locale: 'en-GB',
      timezone: 'Europe/London',
    };

    const sydneyClub: Partial<Club> = {
      id: 'club-syd',
      locale: 'en-AU',
      timezone: 'Australia/Sydney',
    };

    // Builds a reminder-eligible session with one family/swimmer for a club.
    const buildSession = (clubId: string, sessionDate: string): Partial<Session> => ({
      session_id: `sess-${clubId}`,
      club_id: clubId,
      session_name: 'Evening Squad',
      session_date: sessionDate as unknown as Date,
      start_time: '18:30',
      end_time: '19:30',
      location: 'Main Pool',
      status: SessionStatus.SCHEDULED,
      description: null,
      coach_name: 'Coach A',
      squad: {
        squad_name: 'Seniors',
        swimmers: [
          {
            swimmer_id: 'sw-1',
            first_name: 'Alex',
            last_name: 'Smith',
            family: {
              family_id: 'fam-1',
              family_name: 'Smith',
              primary_contact_email: 'smith@example.com',
              primary_contact_name: 'Pat Smith',
            },
          },
        ],
      } as unknown as Session['squad'],
    });

    beforeEach(() => {
      mockEmailService.sendSessionReminder.mockResolvedValue(undefined);
    });

    it('sends reminders for a GB club when it is 18:00 in London', async () => {
      // 2026-03-16 18:30 UTC is 18:30 in London (GMT in March), so local hour 18.
      service.fakeNow = new Date('2026-03-16T18:30:00Z');
      // Club-local tomorrow (London) is 2026-03-17.
      mockRepository.findSessionsForRemindersBetween.mockResolvedValue([
        buildSession('club-gb', '2026-03-17'),
      ]);
      mockClubsRepository.findOne.mockResolvedValue(gbClub);

      await service.sendSessionReminders();

      expect(mockEmailService.sendSessionReminder).toHaveBeenCalledTimes(1);
      const arg = mockEmailService.sendSessionReminder.mock.calls[0][0];
      // Matches the previous hardcoded en-GB formatting. ICU versions differ
      // on whether a comma follows the weekday, so accept both renderings.
      expect(arg.sessionDate).toMatch(/^Tuesday,? 17 March 2026$/);
      expect(arg.fullDateTime).toBe('17/03/2026, 18:30:00');
      expect(arg.recipientEmail).toBe('smith@example.com');
    });

    it('does not send for a GB club when the London local hour is not 18', async () => {
      // 09:00 UTC is 09:00 in London (March), local hour 9, so no dispatch.
      service.fakeNow = new Date('2026-03-16T09:00:00Z');
      mockRepository.findSessionsForRemindersBetween.mockResolvedValue([
        buildSession('club-gb', '2026-03-17'),
      ]);
      mockClubsRepository.findOne.mockResolvedValue(gbClub);

      await service.sendSessionReminders();

      expect(mockEmailService.sendSessionReminder).not.toHaveBeenCalled();
    });

    it('selects a Sydney club only when the Sydney local hour is 18', async () => {
      // 2026-03-16 07:00 UTC is 18:00 in Sydney (AEDT, UTC+11), local hour 18.
      service.fakeNow = new Date('2026-03-16T07:00:00Z');
      // Sydney local tomorrow is 2026-03-17.
      mockRepository.findSessionsForRemindersBetween.mockResolvedValue([
        buildSession('club-syd', '2026-03-17'),
      ]);
      mockClubsRepository.findOne.mockResolvedValue(sydneyClub);

      await service.sendSessionReminders();

      expect(mockEmailService.sendSessionReminder).toHaveBeenCalledTimes(1);
      const arg = mockEmailService.sendSessionReminder.mock.calls[0][0];
      expect(arg.recipientEmail).toBe('smith@example.com');
      // Date-only column renders as its stored calendar date (no timezone shift).
      expect(arg.fullDateTime).toContain('17');
    });

    it('does not select a Sydney club when the Sydney local hour is not 18', async () => {
      // 18:00 UTC is 05:00 next day in Sydney (UTC+11), local hour 5, so no dispatch.
      service.fakeNow = new Date('2026-03-16T18:00:00Z');
      mockRepository.findSessionsForRemindersBetween.mockResolvedValue([
        buildSession('club-syd', '2026-03-17'),
      ]);
      mockClubsRepository.findOne.mockResolvedValue(sydneyClub);

      await service.sendSessionReminders();

      expect(mockEmailService.sendSessionReminder).not.toHaveBeenCalled();
    });

    it('short-circuits when there are no candidate sessions', async () => {
      service.fakeNow = new Date('2026-03-16T18:30:00Z');
      mockRepository.findSessionsForRemindersBetween.mockResolvedValue([]);

      await service.sendSessionReminders();

      expect(mockClubsRepository.findOne).not.toHaveBeenCalled();
      expect(mockEmailService.sendSessionReminder).not.toHaveBeenCalled();
    });
  });
});
