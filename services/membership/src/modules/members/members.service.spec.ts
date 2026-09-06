import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersRepository } from './members.repository';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

describe('MembersService', () => {
  let service: MembersService;
  let _repository: MembersRepository;

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

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByFamilyId: jest.fn(),
    findByClubId: jest.fn(),
    findBySquadId: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: MembersRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    _repository = module.get<MembersRepository>(MembersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new member', async () => {
      const createMemberDto: CreateMemberDto = {
        first_name: 'John',
        last_name: 'Smith',
        dob: '2010-05-15',
        gender: 'M',
        registration_number: '1234567',
      };

      mockRepository.create.mockResolvedValue(mockMember);

      const result = await service.create(createMemberDto);

      expect(result).toEqual(mockMember);
      expect(mockRepository.create).toHaveBeenCalledWith(createMemberDto);
    });

    it('should throw BadRequestException for duplicate registration number', async () => {
      const createMemberDto: CreateMemberDto = {
        first_name: 'John',
        last_name: 'Smith',
        dob: '2010-05-15',
        gender: 'M',
        registration_number: '1234567',
      };

      mockRepository.create.mockRejectedValue({ code: '23505' });

      await expect(service.create(createMemberDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return an array of members', async () => {
      const members = [mockMember];
      mockRepository.findAll.mockResolvedValue(members);

      const result = await service.findAll();

      expect(result).toEqual(members);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single member', async () => {
      mockRepository.findOne.mockResolvedValue(mockMember);

      const result = await service.findOne(mockMember.member_id);

      expect(result).toEqual(mockMember);
      expect(mockRepository.findOne).toHaveBeenCalledWith(mockMember.member_id);
    });

    it('should throw NotFoundException if member not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a member', async () => {
      const updateMemberDto: UpdateMemberDto = {
        first_name: 'Jane',
      };

      mockRepository.findOne.mockResolvedValue(mockMember);
      mockRepository.update.mockResolvedValue({
        ...mockMember,
        ...updateMemberDto,
      });

      const result = await service.update(mockMember.member_id, updateMemberDto);

      expect(result.first_name).toEqual('Jane');
      expect(mockRepository.update).toHaveBeenCalledWith(mockMember.member_id, updateMemberDto);
    });

    it('should throw NotFoundException if member not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { first_name: 'Jane' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a member', async () => {
      mockRepository.findOne.mockResolvedValue(mockMember);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockMember.member_id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockMember.member_id);
    });

    it('should throw NotFoundException if member not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should return member statistics', async () => {
      mockRepository.count.mockResolvedValue(10);

      const result = await service.getStatistics();

      expect(result).toEqual({ total: 10 });
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });
});
