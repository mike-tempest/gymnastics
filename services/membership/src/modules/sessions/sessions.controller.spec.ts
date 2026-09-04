import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

describe('SessionsController', () => {
  let controller: SessionsController;
  let _service: jest.Mocked<SessionsService>;

  const mockSession = {
    session_id: '123e4567-e89b-12d3-a456-426614174000',
    session_name: 'Morning Training',
    session_date: new Date('2026-03-15'),
    start_time: '09:00',
    end_time: '10:00',
    location: 'Main Pool',
    status: SessionStatus.SCHEDULED,
    squad_id: '223e4567-e89b-12d3-a456-426614174001',
  };

  const mockSessionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getUpcomingSessions: jest.fn(),
    getRecentSessions: jest.fn(),
    getSessionsBySquad: jest.fn(),
    getSessionsByDateRange: jest.fn(),
    updateSessionStatus: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [{ provide: SessionsService, useValue: mockSessionsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
    _service = module.get(SessionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call sessionsService.create and return the result', async () => {
      const createDto = {
        session_name: 'Morning Training',
        session_date: new Date('2026-03-15'),
        start_time: '09:00',
        end_time: '10:00',
      };

      mockSessionsService.create.mockResolvedValue(mockSession);

      const result = await controller.create(createDto as unknown as CreateSessionDto);

      expect(result).toEqual(mockSession);
      expect(mockSessionsService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all sessions when no filters are provided', async () => {
      mockSessionsService.findAll.mockResolvedValue([mockSession]);

      const result = await controller.findAll();

      expect(result).toEqual([mockSession]);
      expect(mockSessionsService.findAll).toHaveBeenCalled();
    });

    it('should filter by squad_id when provided', async () => {
      const squadId = mockSession.squad_id;
      mockSessionsService.getSessionsBySquad.mockResolvedValue([mockSession]);

      const result = await controller.findAll(squadId);

      expect(result).toEqual([mockSession]);
      expect(mockSessionsService.getSessionsBySquad).toHaveBeenCalledWith(squadId);
    });

    it('should filter by date range when start_date and end_date are provided', async () => {
      mockSessionsService.getSessionsByDateRange.mockResolvedValue([mockSession]);

      const result = await controller.findAll(undefined, '2026-03-01', '2026-03-31');

      expect(result).toEqual([mockSession]);
      expect(mockSessionsService.getSessionsByDateRange).toHaveBeenCalledWith(
        new Date('2026-03-01'),
        new Date('2026-03-31'),
      );
    });
  });

  describe('getUpcoming', () => {
    it('should return upcoming sessions with a limit', async () => {
      mockSessionsService.getUpcomingSessions.mockResolvedValue([mockSession]);

      const result = await controller.getUpcoming('5');

      expect(result).toEqual([mockSession]);
      expect(mockSessionsService.getUpcomingSessions).toHaveBeenCalledWith(5);
    });

    it('should return upcoming sessions without a limit', async () => {
      mockSessionsService.getUpcomingSessions.mockResolvedValue([mockSession]);

      const _result = await controller.getUpcoming(undefined);

      expect(mockSessionsService.getUpcomingSessions).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getRecent', () => {
    it('should return recent sessions with a custom window', async () => {
      mockSessionsService.getRecentSessions.mockResolvedValue([mockSession]);

      const result = await controller.getRecent('14');

      expect(result).toEqual([mockSession]);
      expect(mockSessionsService.getRecentSessions).toHaveBeenCalledWith(14);
    });

    it('should default the window when days is not provided', async () => {
      mockSessionsService.getRecentSessions.mockResolvedValue([mockSession]);

      await controller.getRecent(undefined);

      expect(mockSessionsService.getRecentSessions).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should return a single session', async () => {
      mockSessionsService.findOne.mockResolvedValue(mockSession);

      const result = await controller.findOne(mockSession.session_id);

      expect(result).toEqual(mockSession);
      expect(mockSessionsService.findOne).toHaveBeenCalledWith(mockSession.session_id);
    });
  });

  describe('update', () => {
    it('should update a session', async () => {
      const updateDto = { session_name: 'Evening Training' };
      const updated = { ...mockSession, session_name: 'Evening Training' };

      mockSessionsService.update.mockResolvedValue(updated as unknown as Session);

      const result = await controller.update(mockSession.session_id, updateDto as UpdateSessionDto);

      expect(result.session_name).toBe('Evening Training');
    });
  });

  describe('updateStatus', () => {
    it('should update the session status', async () => {
      const updated = { ...mockSession, status: SessionStatus.COMPLETED };

      mockSessionsService.updateSessionStatus.mockResolvedValue(updated as unknown as Session);

      const result = await controller.updateStatus(mockSession.session_id, SessionStatus.COMPLETED);

      expect(result.status).toBe(SessionStatus.COMPLETED);
      expect(mockSessionsService.updateSessionStatus).toHaveBeenCalledWith(
        mockSession.session_id,
        SessionStatus.COMPLETED,
      );
    });
  });

  describe('remove', () => {
    it('should remove a session', async () => {
      mockSessionsService.remove.mockResolvedValue(undefined);

      await controller.remove(mockSession.session_id);

      expect(mockSessionsService.remove).toHaveBeenCalledWith(mockSession.session_id);
    });
  });
});
