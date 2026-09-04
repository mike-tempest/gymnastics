import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ActivationService } from './activation.service';
import { Club } from '../clubs/entities/club.entity';
import { Session } from '../sessions/entities/session.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';

class TestableActivationService extends ActivationService {
  public fakeNow = new Date();
  protected now(): Date {
    return this.fakeNow;
  }
}

describe('ActivationService', () => {
  let service: TestableActivationService;

  // 09:30 UTC on 10 August: local hour is 9 in London (BST would make it 10;
  // use a UTC-pinned London winter date instead for determinism). To keep the
  // arithmetic honest we pin "now" per test with clubs in Europe/London and
  // choose instants where London local hour is 9.
  const clubBase = {
    id: 'club-1',
    name: 'Whitby Seals',
    timezone: 'Europe/London',
    activation_day2_sent_at: null,
    activation_day5_sent_at: null,
    activation_day10_sent_at: null,
  };

  const admin = {
    user_id: 'user-1',
    club_id: 'club-1',
    email: 'admin@club.example',
    first_name: 'Sam',
    role: UserRole.SUPER_ADMIN,
  };

  const mockClubsRepository = {
    find: jest.fn(),
    update: jest.fn(),
  };
  const mockSessionsRepository = { count: jest.fn() };
  const mockAttendanceRepository = { count: jest.fn() };
  const mockUsersRepository = { findOne: jest.fn() };
  const mockEmailService = {
    sendActivationScheduleSessions: jest.fn(),
    sendActivationFirstRegister: jest.fn(),
    sendActivationCheckIn: jest.fn(),
  };

  // 08:30 UTC on 10 Aug 2026 is 09:30 in London (BST).
  const nineAmLondon = new Date('2026-08-10T08:30:00Z');

  const clubAgedDays = (days: number) => ({
    ...clubBase,
    created_at: new Date(nineAmLondon.getTime() - days * 24 * 60 * 60 * 1000),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestableActivationService,
        { provide: getRepositoryToken(Club), useValue: mockClubsRepository },
        { provide: getRepositoryToken(Session), useValue: mockSessionsRepository },
        { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepository },
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<TestableActivationService>(TestableActivationService);
    service.fakeNow = nineAmLondon;
    mockUsersRepository.findOne.mockResolvedValue(admin);
    mockSessionsRepository.count.mockResolvedValue(0);
    mockAttendanceRepository.count.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends the day 2 email to a 2-day-old club with no future sessions', async () => {
    mockClubsRepository.find.mockResolvedValue([clubAgedDays(2)]);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).toHaveBeenCalledWith({
      recipientEmail: 'admin@club.example',
      firstName: 'Sam',
      clubName: 'Whitby Seals',
    });
    expect(mockClubsRepository.update).toHaveBeenCalledWith(
      { id: 'club-1' },
      { activation_day2_sent_at: nineAmLondon },
    );
  });

  it('suppresses the day 2 email when a future session already exists, but stamps it', async () => {
    mockClubsRepository.find.mockResolvedValue([clubAgedDays(2)]);
    mockSessionsRepository.count.mockResolvedValue(3);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).not.toHaveBeenCalled();
    expect(mockClubsRepository.update).toHaveBeenCalledWith(
      { id: 'club-1' },
      { activation_day2_sent_at: nineAmLondon },
    );
  });

  it('suppresses the day 5 email when a register has been taken', async () => {
    mockClubsRepository.find.mockResolvedValue([
      { ...clubAgedDays(5), activation_day2_sent_at: new Date() },
    ]);
    mockAttendanceRepository.count.mockResolvedValue(12);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationFirstRegister).not.toHaveBeenCalled();
    expect(mockClubsRepository.update).toHaveBeenCalledWith(
      { id: 'club-1' },
      { activation_day5_sent_at: nineAmLondon },
    );
  });

  it('sends the day 5 email when no register exists', async () => {
    mockClubsRepository.find.mockResolvedValue([
      { ...clubAgedDays(5), activation_day2_sent_at: new Date() },
    ]);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationFirstRegister).toHaveBeenCalled();
  });

  it('skips the day 10 email only when the club both scheduled ahead and took a register', async () => {
    mockClubsRepository.find.mockResolvedValue([
      {
        ...clubAgedDays(10),
        activation_day2_sent_at: new Date(),
        activation_day5_sent_at: new Date(),
      },
    ]);
    mockSessionsRepository.count.mockResolvedValue(2);
    mockAttendanceRepository.count.mockResolvedValue(30);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationCheckIn).not.toHaveBeenCalled();
    expect(mockClubsRepository.update).toHaveBeenCalledWith(
      { id: 'club-1' },
      { activation_day10_sent_at: nineAmLondon },
    );
  });

  it('sends the day 10 email when the club scheduled ahead but never took a register', async () => {
    mockClubsRepository.find.mockResolvedValue([
      {
        ...clubAgedDays(10),
        activation_day2_sent_at: new Date(),
        activation_day5_sent_at: new Date(),
      },
    ]);
    mockSessionsRepository.count.mockResolvedValue(2);
    mockAttendanceRepository.count.mockResolvedValue(0);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationCheckIn).toHaveBeenCalled();
  });

  it('sends at most one email per club per run when several thresholds are crossed', async () => {
    mockClubsRepository.find.mockResolvedValue([clubAgedDays(11)]);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).toHaveBeenCalledTimes(1);
    expect(mockEmailService.sendActivationFirstRegister).not.toHaveBeenCalled();
    expect(mockEmailService.sendActivationCheckIn).not.toHaveBeenCalled();
  });

  it('does nothing outside the club-local send hour', async () => {
    // 20:30 UTC is 21:30 in London.
    service.fakeNow = new Date('2026-08-10T20:30:00Z');
    mockClubsRepository.find.mockResolvedValue([
      { ...clubAgedDays(2), created_at: new Date('2026-08-08T08:30:00Z') },
    ]);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).not.toHaveBeenCalled();
    expect(mockClubsRepository.update).not.toHaveBeenCalled();
  });

  it('dispatches by the club timezone, not server time', async () => {
    // 23:30 UTC on the 9th is 09:30 on the 10th in Sydney.
    service.fakeNow = new Date('2026-08-09T23:30:00Z');
    mockClubsRepository.find.mockResolvedValue([
      {
        ...clubBase,
        timezone: 'Australia/Sydney',
        created_at: new Date(service.fakeNow.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    ]);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).toHaveBeenCalled();
  });

  it('skips clubs with no super admin without stamping', async () => {
    mockClubsRepository.find.mockResolvedValue([clubAgedDays(2)]);
    mockUsersRepository.findOne.mockResolvedValue(null);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).not.toHaveBeenCalled();
    expect(mockClubsRepository.update).not.toHaveBeenCalled();
  });

  it('does not re-send already-stamped steps', async () => {
    mockClubsRepository.find.mockResolvedValue([
      {
        ...clubAgedDays(6),
        activation_day2_sent_at: new Date(),
        activation_day5_sent_at: new Date(),
      },
    ]);

    await service.processActivationEmails();

    expect(mockEmailService.sendActivationScheduleSessions).not.toHaveBeenCalled();
    expect(mockEmailService.sendActivationFirstRegister).not.toHaveBeenCalled();
    expect(mockEmailService.sendActivationCheckIn).not.toHaveBeenCalled();
  });
});
