import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsRepository } from './audit-logs.repository';
import { AuditLog, AuditAction, AuditEntityType } from './entities/audit-log.entity';

describe('AuditLogsService', () => {
  let service: AuditLogsService;

  const mockAuditLog: Partial<AuditLog> = {
    audit_log_id: '123e4567-e89b-12d3-a456-426614174000',
    user_id: '223e4567-e89b-12d3-a456-426614174001',
    user_email: 'coach@swimclub.org.uk',
    action: AuditAction.CREATE,
    entity_type: AuditEntityType.SWIMMER,
    entity_id: '333e4567-e89b-12d3-a456-426614174002',
    description: 'Created a new swimmer record',
    created_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUser: jest.fn(),
    findByEntity: jest.fn(),
    findByAction: jest.fn(),
    findByDateRange: jest.fn(),
    findRecent: jest.fn(),
    count: jest.fn(),
    countByAction: jest.fn(),
    countByEntityType: jest.fn(),
    deleteOlderThan: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogsService, { provide: AuditLogsRepository, useValue: mockRepository }],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return audit logs with default limit and offset', async () => {
      mockRepository.findAll.mockResolvedValue([mockAuditLog]);

      const result = await service.findAll();

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should pass custom limit and offset to the repository', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      await service.findAll(50, 10);

      expect(mockRepository.findAll).toHaveBeenCalledWith(50, 10);
    });
  });

  describe('findOne', () => {
    it('should return a single audit log entry', async () => {
      mockRepository.findOne.mockResolvedValue(mockAuditLog);

      const result = await service.findOne(mockAuditLog.audit_log_id as string);

      expect(result).toEqual(mockAuditLog);
    });

    it('should return null when the audit log does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByUser', () => {
    it('should return audit logs for a specific user', async () => {
      mockRepository.findByUser.mockResolvedValue([mockAuditLog]);

      const result = await service.findByUser(mockAuditLog.user_id as string);

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.findByUser).toHaveBeenCalledWith(mockAuditLog.user_id, 100);
    });
  });

  describe('findByEntity', () => {
    it('should return audit logs for a specific entity', async () => {
      mockRepository.findByEntity.mockResolvedValue([mockAuditLog]);

      const result = await service.findByEntity(
        AuditEntityType.SWIMMER,
        mockAuditLog.entity_id as string,
      );

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.findByEntity).toHaveBeenCalledWith(
        AuditEntityType.SWIMMER,
        mockAuditLog.entity_id,
        100,
      );
    });
  });

  describe('findByAction', () => {
    it('should return audit logs for a specific action', async () => {
      mockRepository.findByAction.mockResolvedValue([mockAuditLog]);

      const result = await service.findByAction(AuditAction.CREATE);

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.findByAction).toHaveBeenCalledWith(AuditAction.CREATE, 100);
    });
  });

  describe('findByDateRange', () => {
    it('should return audit logs within a date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-03-31');

      mockRepository.findByDateRange.mockResolvedValue([mockAuditLog]);

      const result = await service.findByDateRange(startDate, endDate);

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.findByDateRange).toHaveBeenCalledWith(startDate, endDate);
    });
  });

  describe('findRecent', () => {
    it('should return recent audit logs with default 24 hours', async () => {
      mockRepository.findRecent.mockResolvedValue([mockAuditLog]);

      const result = await service.findRecent();

      expect(result).toEqual([mockAuditLog]);
      expect(mockRepository.findRecent).toHaveBeenCalledWith(24);
    });

    it('should pass custom hours parameter', async () => {
      mockRepository.findRecent.mockResolvedValue([]);

      await service.findRecent(48);

      expect(mockRepository.findRecent).toHaveBeenCalledWith(48);
    });
  });

  describe('getStatistics', () => {
    it('should return aggregated audit log statistics', async () => {
      mockRepository.count.mockResolvedValue(500);
      mockRepository.countByAction.mockResolvedValue(50);
      mockRepository.countByEntityType.mockResolvedValue(40);

      const result = await service.getStatistics();

      expect(result.total).toBe(500);
      expect(result.byAction).toBeDefined();
      expect(result.byEntityType).toBeDefined();
      // Verify all action types are included
      for (const action of Object.values(AuditAction)) {
        expect(result.byAction[action]).toBeDefined();
      }
      // Verify all entity types are included
      for (const entityType of Object.values(AuditEntityType)) {
        expect(result.byEntityType[entityType]).toBeDefined();
      }
    });
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      const createDto = {
        user_id: mockAuditLog.user_id as string,
        action: AuditAction.CREATE,
        entity_type: AuditEntityType.SWIMMER,
        entity_id: mockAuditLog.entity_id,
        description: 'Created swimmer',
      };

      mockRepository.create.mockResolvedValue(mockAuditLog);

      const result = await service.log(createDto);

      expect(result).toEqual(mockAuditLog);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('logAction', () => {
    it('should create an audit log with convenience parameters', async () => {
      mockRepository.create.mockResolvedValue(mockAuditLog);

      await service.logAction(
        'user-123',
        AuditAction.UPDATE,
        AuditEntityType.SWIMMER,
        'swimmer-456',
        'Updated swimmer details',
      );

      expect(mockRepository.create).toHaveBeenCalledWith({
        user_id: 'user-123',
        action: AuditAction.UPDATE,
        entity_type: AuditEntityType.SWIMMER,
        entity_id: 'swimmer-456',
        description: 'Updated swimmer details',
        changes: undefined,
      });
    });
  });

  describe('logLogin', () => {
    it('should log a login event with IP address and user agent', async () => {
      mockRepository.create.mockResolvedValue(mockAuditLog);

      await service.logLogin(
        'user-123',
        'user@example.com',
        'club-456',
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // club_id is passed explicitly because login is a public route with
          // no tenant context, and audit_logs.club_id is NOT NULL.
          club_id: 'club-456',
          user_id: 'user-123',
          user_email: 'user@example.com',
          action: AuditAction.LOGIN,
          entity_type: AuditEntityType.USER,
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
        }),
      );
    });
  });

  describe('logLogout', () => {
    it('should log a logout event', async () => {
      mockRepository.create.mockResolvedValue(mockAuditLog);

      await service.logLogout('user-123', 'user@example.com', 'club-456');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          club_id: 'club-456',
          user_id: 'user-123',
          action: AuditAction.LOGOUT,
          entity_type: AuditEntityType.USER,
        }),
      );
    });
  });

  describe('logClubSignup', () => {
    it('records the signup as a CLUB create, the head of the activation funnel', async () => {
      mockRepository.create.mockResolvedValue(mockAuditLog);

      await service.logClubSignup('user-123', 'admin@club.org.uk', 'club-456', 'Aqualina ASC');

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          club_id: 'club-456',
          user_id: 'user-123',
          user_email: 'admin@club.org.uk',
          action: AuditAction.CREATE,
          entity_type: AuditEntityType.CLUB,
          entity_id: 'club-456',
          metadata: { club_name: 'Aqualina ASC' },
        }),
      );
    });
  });
});
