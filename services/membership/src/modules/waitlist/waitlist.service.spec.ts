import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistService } from './waitlist.service';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistEntry } from './entities/waitlist.entity';
import { EmailService } from '../email/email.service';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';

describe('WaitlistService', () => {
  let service: WaitlistService;

  const mockEntry: WaitlistEntry = {
    id: 'aaaa-bbbb-cccc-dddd',
    club_id: 'cccc-dddd-eeee-ffff',
    email: 'test@example.com',
    name: 'Jane Smith',
    clubName: 'Otters SC',
    role: 'coach',
    source: 'website',
    createdAt: new Date('2026-03-01'),
    confirmationSentAt: null,
    drip1SentAt: null,
    drip2SentAt: null,
    drip3SentAt: null,
  };

  // The service now delegates all DB access to WaitlistRepository, which owns the
  // tenant enforcement (and the public-path getClubIdOrNull handling). The service
  // spec therefore mocks the repository, not the raw TypeORM repository.
  const mockRepo = {
    createEntity: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findDripEligible: jest.fn(),
  };

  const mockEmailService = {
    sendWaitlistConfirmation: jest.fn(),
    sendWaitlistDrip1: jest.fn(),
    sendWaitlistDrip2: jest.fn(),
    sendWaitlistDrip3: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: WaitlistRepository,
          useValue: mockRepo,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto: CreateWaitlistDto = {
      email: ' Test@Example.com ',
      name: 'Jane Smith',
      clubName: 'Otters SC',
      role: 'coach',
    };

    it('should create a waitlist entry and fire a confirmation email', async () => {
      mockRepo.createEntity.mockReturnValue(mockEntry);
      mockRepo.save.mockResolvedValue(mockEntry);
      mockEmailService.sendWaitlistConfirmation.mockResolvedValue(undefined);

      const result = await service.create(dto);

      expect(result).toEqual({ success: true, message: 'Thanks! We will be in touch.' });
      expect(mockRepo.createEntity).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Jane Smith',
        clubName: 'Otters SC',
        role: 'coach',
        source: 'website',
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockEntry);

      // Allow the fire-and-forget promise to resolve
      await new Promise(process.nextTick);

      expect(mockEmailService.sendWaitlistConfirmation).toHaveBeenCalledWith(mockEntry);
      expect(mockRepo.update).toHaveBeenCalledWith(mockEntry.id, {
        confirmationSentAt: expect.any(Date),
      });
    });

    it('should swallow a duplicate email error (Postgres 23505)', async () => {
      mockRepo.createEntity.mockReturnValue(mockEntry);
      mockRepo.save.mockRejectedValue({ code: '23505' });

      const result = await service.create(dto);

      expect(result).toEqual({ success: true, message: 'Thanks! We will be in touch.' });
      // The entry was created in memory (with id) before save failed,
      // so the fire-and-forget email may still be attempted
    });

    it('should rethrow non-duplicate errors', async () => {
      const error = new Error('connection refused');
      mockRepo.createEntity.mockReturnValue(mockEntry);
      mockRepo.save.mockRejectedValue(error);

      await expect(service.create(dto)).rejects.toThrow('connection refused');
    });
  });

  describe('findAll', () => {
    it('should return entries from the repository', async () => {
      const entries = [mockEntry];
      mockRepo.findAll.mockResolvedValue(entries);

      const result = await service.findAll();

      expect(result).toEqual(entries);
      expect(mockRepo.findAll).toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should return the number of waitlist entries', async () => {
      mockRepo.count.mockResolvedValue(42);

      const result = await service.count();

      expect(result).toBe(42);
      expect(mockRepo.count).toHaveBeenCalled();
    });
  });

  describe('processDrips', () => {
    it('should send drip 1 emails for eligible entries', async () => {
      const eligibleEntry = {
        ...mockEntry,
        confirmationSentAt: new Date('2026-03-01'),
        drip1SentAt: null,
      };

      mockRepo.findDripEligible
        .mockResolvedValueOnce([eligibleEntry]) // drip 1 query
        .mockResolvedValueOnce([]) // drip 2 query
        .mockResolvedValueOnce([]); // drip 3 query
      mockEmailService.sendWaitlistDrip1.mockResolvedValue(undefined);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.processDrips();

      expect(result).toEqual({ sent: 1 });
      expect(mockEmailService.sendWaitlistDrip1).toHaveBeenCalledWith(eligibleEntry);
      expect(mockRepo.update).toHaveBeenCalledWith(eligibleEntry.id, {
        drip1SentAt: expect.any(Date),
      });
    });

    it('should send drip 2 emails for eligible entries', async () => {
      const eligibleEntry = {
        ...mockEntry,
        drip1SentAt: new Date('2026-03-01'),
        drip2SentAt: null,
      };

      mockRepo.findDripEligible
        .mockResolvedValueOnce([]) // drip 1
        .mockResolvedValueOnce([eligibleEntry]) // drip 2
        .mockResolvedValueOnce([]); // drip 3
      mockEmailService.sendWaitlistDrip2.mockResolvedValue(undefined);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.processDrips();

      expect(result).toEqual({ sent: 1 });
      expect(mockEmailService.sendWaitlistDrip2).toHaveBeenCalledWith(eligibleEntry);
    });

    it('should send drip 3 emails for eligible entries', async () => {
      const eligibleEntry = {
        ...mockEntry,
        drip2SentAt: new Date('2026-03-01'),
        drip3SentAt: null,
      };

      mockRepo.findDripEligible
        .mockResolvedValueOnce([]) // drip 1
        .mockResolvedValueOnce([]) // drip 2
        .mockResolvedValueOnce([eligibleEntry]); // drip 3
      mockEmailService.sendWaitlistDrip3.mockResolvedValue(undefined);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.processDrips();

      expect(result).toEqual({ sent: 1 });
      expect(mockEmailService.sendWaitlistDrip3).toHaveBeenCalledWith(eligibleEntry);
    });

    it('should log errors and continue when an email fails to send', async () => {
      const entry1 = { ...mockEntry, id: 'entry-1', confirmationSentAt: new Date() };
      const entry2 = { ...mockEntry, id: 'entry-2', confirmationSentAt: new Date() };

      mockRepo.findDripEligible
        .mockResolvedValueOnce([entry1, entry2]) // drip 1
        .mockResolvedValueOnce([]) // drip 2
        .mockResolvedValueOnce([]); // drip 3

      mockEmailService.sendWaitlistDrip1
        .mockRejectedValueOnce(new Error('SMTP timeout'))
        .mockResolvedValueOnce(undefined);
      mockRepo.update.mockResolvedValue(undefined);

      const result = await service.processDrips();

      // First entry failed, second succeeded
      expect(result).toEqual({ sent: 1 });
      expect(mockEmailService.sendWaitlistDrip1).toHaveBeenCalledTimes(2);
      expect(mockRepo.update).toHaveBeenCalledTimes(1);
      expect(mockRepo.update).toHaveBeenCalledWith('entry-2', {
        drip1SentAt: expect.any(Date),
      });
    });

    it('should return zero sent when there are no eligible entries', async () => {
      mockRepo.findDripEligible
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.processDrips();

      expect(result).toEqual({ sent: 0 });
    });
  });
});
