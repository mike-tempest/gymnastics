import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SwimmersService } from './swimmers.service';
import { SwimmersRepository } from './swimmers.repository';
import { CreateSwimmerDto } from './dto/create-swimmer.dto';
import { UpdateSwimmerDto } from './dto/update-swimmer.dto';

describe('SwimmersService', () => {
  let service: SwimmersService;
  let _repository: SwimmersRepository;

  const mockSwimmer = {
    swimmer_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'John',
    last_name: 'Smith',
    dob: new Date('2010-05-15'),
    gender: 'M',
    se_number: '1234567',
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
        SwimmersService,
        {
          provide: SwimmersRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SwimmersService>(SwimmersService);
    _repository = module.get<SwimmersRepository>(SwimmersRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new swimmer', async () => {
      const createSwimmerDto: CreateSwimmerDto = {
        first_name: 'John',
        last_name: 'Smith',
        dob: '2010-05-15',
        gender: 'M',
        se_number: '1234567',
      };

      mockRepository.create.mockResolvedValue(mockSwimmer);

      const result = await service.create(createSwimmerDto);

      expect(result).toEqual(mockSwimmer);
      expect(mockRepository.create).toHaveBeenCalledWith(createSwimmerDto);
    });

    it('should throw BadRequestException for duplicate registration number', async () => {
      const createSwimmerDto: CreateSwimmerDto = {
        first_name: 'John',
        last_name: 'Smith',
        dob: '2010-05-15',
        gender: 'M',
        se_number: '1234567',
      };

      mockRepository.create.mockRejectedValue({ code: '23505' });

      await expect(service.create(createSwimmerDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return an array of swimmers', async () => {
      const swimmers = [mockSwimmer];
      mockRepository.findAll.mockResolvedValue(swimmers);

      const result = await service.findAll();

      expect(result).toEqual(swimmers);
      expect(mockRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single swimmer', async () => {
      mockRepository.findOne.mockResolvedValue(mockSwimmer);

      const result = await service.findOne(mockSwimmer.swimmer_id);

      expect(result).toEqual(mockSwimmer);
      expect(mockRepository.findOne).toHaveBeenCalledWith(mockSwimmer.swimmer_id);
    });

    it('should throw NotFoundException if swimmer not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a swimmer', async () => {
      const updateSwimmerDto: UpdateSwimmerDto = {
        first_name: 'Jane',
      };

      mockRepository.findOne.mockResolvedValue(mockSwimmer);
      mockRepository.update.mockResolvedValue({
        ...mockSwimmer,
        ...updateSwimmerDto,
      });

      const result = await service.update(mockSwimmer.swimmer_id, updateSwimmerDto);

      expect(result.first_name).toEqual('Jane');
      expect(mockRepository.update).toHaveBeenCalledWith(mockSwimmer.swimmer_id, updateSwimmerDto);
    });

    it('should throw NotFoundException if swimmer not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { first_name: 'Jane' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a swimmer', async () => {
      mockRepository.findOne.mockResolvedValue(mockSwimmer);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockSwimmer.swimmer_id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockSwimmer.swimmer_id);
    });

    it('should throw NotFoundException if swimmer not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should return swimmer statistics', async () => {
      mockRepository.count.mockResolvedValue(10);

      const result = await service.getStatistics();

      expect(result).toEqual({ total: 10 });
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });
});
