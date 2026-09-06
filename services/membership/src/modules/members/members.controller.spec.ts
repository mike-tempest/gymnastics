import { Test, TestingModule } from '@nestjs/testing';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { BulkCreateMemberDto } from './dto/bulk-create-member.dto';

describe('MembersController', () => {
  let controller: MembersController;
  let _service: MembersService;

  const mockMember = {
    member_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'John',
    last_name: 'Smith',
    dob: new Date('2010-05-15'),
    gender: 'M',
    registration_number: '1234567',
    family_id: null,
    club_id: null,
    squad_id: null,
    medical_notes: null,
    photo_url: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByFamilyId: jest.fn(),
    findByClubId: jest.fn(),
    findBySquadId: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    bulkCreate: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [
        {
          provide: MembersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<MembersController>(MembersController);
    _service = module.get<MembersService>(MembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the correct DTO', async () => {
      const createMemberDto: CreateMemberDto = {
        first_name: 'John',
        last_name: 'Smith',
        dob: '2010-05-15',
        gender: 'M',
        registration_number: '1234567',
      };

      mockService.create.mockResolvedValue(mockMember);

      const result = await controller.create(createMemberDto);

      expect(result).toEqual(mockMember);
      expect(mockService.create).toHaveBeenCalledWith(createMemberDto);
    });
  });

  describe('bulkCreate', () => {
    it('should call service.bulkCreate with the members array', async () => {
      const members: CreateMemberDto[] = [
        {
          first_name: 'John',
          last_name: 'Smith',
          dob: '2010-05-15',
          gender: 'M',
          registration_number: '1234567',
        },
        {
          first_name: 'Amy',
          last_name: 'Brown',
          dob: '2011-03-22',
          gender: 'F',
          registration_number: '7654321',
        },
      ];
      const bulkDto: BulkCreateMemberDto = { members };
      const bulkResult = { created: [mockMember], errors: [] };

      mockService.bulkCreate.mockResolvedValue(bulkResult);

      const result = await controller.bulkCreate(bulkDto);

      expect(result).toEqual(bulkResult);
      expect(mockService.bulkCreate).toHaveBeenCalledWith(members);
    });
  });

  describe('findAll', () => {
    it('should return all members when no query params are provided', async () => {
      mockService.findAll.mockResolvedValue([mockMember]);

      const result = await controller.findAll();

      expect(result).toEqual([mockMember]);
      expect(mockService.findAll).toHaveBeenCalled();
    });

    it('should filter by family_id when provided', async () => {
      const familyId = 'family-001';
      mockService.findByFamilyId.mockResolvedValue([mockMember]);

      const result = await controller.findAll(familyId);

      expect(result).toEqual([mockMember]);
      expect(mockService.findByFamilyId).toHaveBeenCalledWith(familyId);
      expect(mockService.findAll).not.toHaveBeenCalled();
    });

    it('should ignore a club_id query param and use the tenant context instead', async () => {
      // The controller no longer accepts ?club_id=; the param is intentionally
      // dropped so a caller cannot read another club's members. findAll() is
      // already scoped to the active club via the tenant context.
      mockService.findAll.mockResolvedValue([mockMember]);

      const result = await controller.findAll();

      expect(result).toEqual([mockMember]);
      expect(mockService.findAll).toHaveBeenCalled();
      expect(mockService.findByClubId).not.toHaveBeenCalled();
    });

    it('should filter by squad_id when provided', async () => {
      const squadId = 'squad-001';
      mockService.findBySquadId.mockResolvedValue([mockMember]);

      const result = await controller.findAll(undefined, squadId);

      expect(result).toEqual([mockMember]);
      expect(mockService.findBySquadId).toHaveBeenCalledWith(squadId);
    });
  });

  describe('getStatistics', () => {
    it('should return member statistics', async () => {
      mockService.getStatistics.mockResolvedValue({ total: 42 });

      const result = await controller.getStatistics();

      expect(result).toEqual({ total: 42 });
    });
  });

  describe('findOne', () => {
    it('should return a single member by ID', async () => {
      mockService.findOne.mockResolvedValue(mockMember);

      const result = await controller.findOne(mockMember.member_id);

      expect(result).toEqual(mockMember);
      expect(mockService.findOne).toHaveBeenCalledWith(mockMember.member_id);
    });
  });

  describe('update', () => {
    it('should call service.update with the correct arguments', async () => {
      const updateDto: UpdateMemberDto = { first_name: 'Jonathan' };
      const updatedMember = { ...mockMember, first_name: 'Jonathan' };

      mockService.update.mockResolvedValue(updatedMember);

      const result = await controller.update(mockMember.member_id, updateDto);

      expect(result).toEqual(updatedMember);
      expect(mockService.update).toHaveBeenCalledWith(mockMember.member_id, updateDto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with the correct ID', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove(mockMember.member_id);

      expect(mockService.remove).toHaveBeenCalledWith(mockMember.member_id);
    });
  });
});
