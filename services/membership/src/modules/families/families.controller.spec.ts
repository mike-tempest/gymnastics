import { Test, TestingModule } from '@nestjs/testing';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

describe('FamiliesController', () => {
  let controller: FamiliesController;
  let _service: FamiliesService;

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
    swimmers: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getStatistics: jest.fn(),
    generateInvite: jest.fn(),
    acceptInvite: jest.fn(),
    verifyInviteToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FamiliesController],
      providers: [
        {
          provide: FamiliesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<FamiliesController>(FamiliesController);
    _service = module.get<FamiliesService>(FamiliesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the correct DTO', async () => {
      const createFamilyDto: CreateFamilyDto = {
        family_name: 'The Smiths',
        primary_contact_name: 'Jane Smith',
        primary_contact_email: 'jane.smith@example.com',
      };

      mockService.create.mockResolvedValue(mockFamily);

      const result = await controller.create(createFamilyDto);

      expect(result).toEqual(mockFamily);
      expect(mockService.create).toHaveBeenCalledWith(createFamilyDto);
    });
  });

  describe('findAll', () => {
    it('should return all families', async () => {
      mockService.findAll.mockResolvedValue([mockFamily]);

      const result = await controller.findAll();

      expect(result).toEqual([mockFamily]);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return family statistics', async () => {
      mockService.getStatistics.mockResolvedValue({ total: 5 });

      const result = await controller.getStatistics();

      expect(result).toEqual({ total: 5 });
    });
  });

  describe('findOne', () => {
    it('should return a single family by ID', async () => {
      mockService.findOne.mockResolvedValue(mockFamily);

      const result = await controller.findOne(mockFamily.family_id);

      expect(result).toEqual(mockFamily);
      expect(mockService.findOne).toHaveBeenCalledWith(mockFamily.family_id);
    });
  });

  describe('generateInvite', () => {
    it('should return a token and invite URL for the specified family', async () => {
      const inviteResponse = {
        token: 'abc123tokenvalue',
        inviteUrl: 'http://localhost:3000/families/invite?token=abc123tokenvalue',
      };

      mockService.generateInvite.mockResolvedValue(inviteResponse);

      const result = await controller.generateInvite(mockFamily.family_id);

      expect(result).toEqual(inviteResponse);
      expect(mockService.generateInvite).toHaveBeenCalledWith(mockFamily.family_id);
    });
  });

  describe('acceptInvite', () => {
    it('should return the family when a valid token is provided', async () => {
      const acceptInviteDto: AcceptInviteDto = { token: 'abc123tokenvalue' };

      mockService.acceptInvite.mockResolvedValue(mockFamily);

      const result = await controller.acceptInvite(acceptInviteDto);

      expect(result).toEqual(mockFamily);
      expect(mockService.acceptInvite).toHaveBeenCalledWith('abc123tokenvalue', undefined);
    });
  });

  describe('verifyInviteToken', () => {
    it('should return validity status and family for a given token', async () => {
      const verifyResponse = { valid: true, family: mockFamily };

      mockService.verifyInviteToken.mockResolvedValue(verifyResponse);

      const result = await controller.verifyInviteToken('abc123tokenvalue');

      expect(result).toEqual(verifyResponse);
      expect(mockService.verifyInviteToken).toHaveBeenCalledWith('abc123tokenvalue');
    });
  });

  describe('update', () => {
    it('should call service.update with the correct arguments', async () => {
      const updateDto: UpdateFamilyDto = { city: 'Leeds' };
      const updatedFamily = { ...mockFamily, city: 'Leeds' };

      mockService.update.mockResolvedValue(updatedFamily);

      const result = await controller.update(mockFamily.family_id, updateDto);

      expect(result).toEqual(updatedFamily);
      expect(mockService.update).toHaveBeenCalledWith(mockFamily.family_id, updateDto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with the correct ID', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove(mockFamily.family_id);

      expect(mockService.remove).toHaveBeenCalledWith(mockFamily.family_id);
    });
  });
});
