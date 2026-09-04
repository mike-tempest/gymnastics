import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { RecipientType } from './entities/communication.entity';
import { EmailService } from '../email/email.service';
import { ClubsService } from '../clubs/clubs.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

describe('CommunicationsService', () => {
  let service: CommunicationsService;

  const mockCommunication = {
    communication_id: '123e4567-e89b-12d3-a456-426614174000',
    subject: 'Training cancelled this Saturday',
    body: 'Due to a gala, Saturday training is cancelled.',
    recipient_type: RecipientType.ALL,
    squad_id: null,
    family_id: null,
    recipient_count: 12,
    sent_date: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findRecipientEmails: jest.fn(),
  };

  const mockEmailService = {
    sendBroadcast: jest.fn(),
  };

  const mockClubsService = {
    findOne: jest.fn(),
  };

  const mockTenantContext = {
    getClubId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunicationsService,
        {
          provide: CommunicationsRepository,
          useValue: mockRepository,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ClubsService,
          useValue: mockClubsService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContext,
        },
      ],
    }).compile();

    service = module.get<CommunicationsService>(CommunicationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new communication', async () => {
      const createDto: CreateCommunicationDto = {
        subject: 'Training cancelled this Saturday',
        body: 'Due to a gala, Saturday training is cancelled.',
        recipientType: RecipientType.ALL,
      };

      mockRepository.create.mockResolvedValue(mockCommunication);
      mockRepository.findRecipientEmails.mockResolvedValue([]);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCommunication);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of communications', async () => {
      const communications = [mockCommunication];
      mockRepository.findAll.mockResolvedValue(communications);

      const result = await service.findAll();

      expect(result).toEqual(communications);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single communication', async () => {
      mockRepository.findOne.mockResolvedValue(mockCommunication);

      const result = await service.findOne(mockCommunication.communication_id);

      expect(result).toEqual(mockCommunication);
      expect(mockRepository.findOne).toHaveBeenCalledWith(mockCommunication.communication_id);
    });

    it('should throw NotFoundException if communication not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
