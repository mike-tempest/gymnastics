import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FamiliesService } from './families.service';
import { FamiliesRepository } from './families.repository';
import { UsersService } from '../users/users.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

describe('FamiliesService', () => {
  let service: FamiliesService;
  let _repository: FamiliesRepository;

  const mockFamily = {
    family_id: '334e5678-e89b-12d3-a456-426614174002',
    family_name: 'The Smiths',
    primary_contact_name: 'Jane Smith',
    primary_contact_email: 'jane.smith@example.com',
    primary_contact_phone: '07700900000',
    address_line1: '12 Oak Street',
    address_line2: null,
    city: 'Manchester',
    postcode: 'M1 1AA',
    members: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockInvite = {
    invite_id: 'invite-001',
    family_id: mockFamily.family_id,
    token: 'abc123tokenvalue',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    family: mockFamily,
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createInvite: jest.fn(),
    findInviteByToken: jest.fn(),
    removeInvite: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  };

  const mockUsersService = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FamiliesService,
        {
          provide: FamiliesRepository,
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<FamiliesService>(FamiliesService);
    _repository = module.get<FamiliesRepository>(FamiliesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new family', async () => {
      const createFamilyDto: CreateFamilyDto = {
        family_name: 'The Smiths',
        primary_contact_name: 'Jane Smith',
        primary_contact_email: 'jane.smith@example.com',
      };

      mockRepository.create.mockResolvedValue(mockFamily);

      const result = await service.create(createFamilyDto);

      expect(result).toEqual(mockFamily);
      expect(mockRepository.create).toHaveBeenCalledWith(createFamilyDto);
    });

    it('should throw BadRequestException on duplicate family', async () => {
      const createFamilyDto: CreateFamilyDto = {
        family_name: 'The Smiths',
        primary_contact_name: 'Jane Smith',
        primary_contact_email: 'jane.smith@example.com',
      };

      mockRepository.create.mockRejectedValue({ code: '23505' });

      await expect(service.create(createFamilyDto)).rejects.toThrow(BadRequestException);
    });

    it('should re-throw unexpected errors', async () => {
      const createFamilyDto: CreateFamilyDto = {
        family_name: 'The Smiths',
        primary_contact_name: 'Jane Smith',
        primary_contact_email: 'jane.smith@example.com',
      };

      const unexpectedError = new Error('Database connection lost');
      mockRepository.create.mockRejectedValue(unexpectedError);

      await expect(service.create(createFamilyDto)).rejects.toThrow('Database connection lost');
    });
  });

  describe('findAll', () => {
    it('should return all families', async () => {
      mockRepository.findAll.mockResolvedValue([mockFamily]);

      const result = await service.findAll();

      expect(result).toEqual([mockFamily]);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should return an empty array when no families exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single family by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockFamily);

      const result = await service.findOne(mockFamily.family_id);

      expect(result).toEqual(mockFamily);
      expect(mockRepository.findOne).toHaveBeenCalledWith(mockFamily.family_id);
    });

    it('should throw NotFoundException if family does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a family successfully', async () => {
      const updateDto: UpdateFamilyDto = { city: 'Liverpool' };
      const updatedFamily = { ...mockFamily, city: 'Liverpool' };

      mockRepository.findOne.mockResolvedValue(mockFamily);
      mockRepository.update.mockResolvedValue(updatedFamily);

      const result = await service.update(mockFamily.family_id, updateDto);

      expect(result.city).toBe('Liverpool');
      expect(mockRepository.update).toHaveBeenCalledWith(mockFamily.family_id, updateDto);
    });

    it('should throw NotFoundException if family does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { city: 'Liverpool' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException on duplicate constraint', async () => {
      mockRepository.findOne.mockResolvedValue(mockFamily);
      mockRepository.update.mockRejectedValue({ code: '23505' });

      await expect(
        service.update(mockFamily.family_id, { primary_contact_email: 'duplicate@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove a family successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockFamily);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockFamily.family_id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockFamily.family_id);
    });

    it('should throw NotFoundException if family does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should return family statistics', async () => {
      mockRepository.count.mockResolvedValue(8);

      const result = await service.getStatistics();

      expect(result).toEqual({ total: 8 });
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });

  describe('generateInvite', () => {
    it('should generate an invite token and URL for a valid family', async () => {
      mockRepository.findOne.mockResolvedValue(mockFamily);
      mockRepository.createInvite.mockResolvedValue(mockInvite);

      const result = await service.generateInvite(mockFamily.family_id);

      expect(result.token).toBeDefined();
      expect(result.inviteUrl).toContain('http://localhost:3000/invite/');
      expect(mockRepository.createInvite).toHaveBeenCalledWith(
        mockFamily.family_id,
        expect.any(String),
        expect.any(Date),
      );
    });

    it('should throw NotFoundException if family does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.generateInvite('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptInvite', () => {
    it('should return the family for a valid invite token', async () => {
      mockRepository.findInviteByToken.mockResolvedValue(mockInvite);

      const result = await service.acceptInvite(mockInvite.token);

      expect(result).toEqual(mockFamily);
    });

    it('should throw BadRequestException for an invalid or expired token', async () => {
      mockRepository.findInviteByToken.mockResolvedValue(null);

      await expect(service.acceptInvite('invalid-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyInviteToken', () => {
    it('should return valid=true and the family for a valid token', async () => {
      mockRepository.findInviteByToken.mockResolvedValue(mockInvite);

      const result = await service.verifyInviteToken(mockInvite.token);

      expect(result.valid).toBe(true);
      expect(result.family).toEqual(mockFamily);
    });

    it('should return valid=false for an invalid token', async () => {
      mockRepository.findInviteByToken.mockResolvedValue(null);

      const result = await service.verifyInviteToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.family).toBeUndefined();
    });
  });
});
