import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SquadsService } from './squads.service';
import { SquadsRepository } from './squads.repository';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';

describe('SquadsService', () => {
  let service: SquadsService;
  let _repository: SquadsRepository;

  const mockSquad = {
    squad_id: '223e4567-e89b-12d3-a456-426614174001',
    squad_name: 'Juniors',
    description: 'Junior development squad',
    min_age: 8,
    max_age: 12,
    coach_name: 'Sarah Jones',
    training_times: 'Monday 17:00, Wednesday 17:00',
    max_capacity: 20,
    swimmers: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSwimmer = {
    swimmer_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'Tom',
    last_name: 'Brown',
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findAllNames: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    assignSwimmer: jest.fn(),
    removeSwimmer: jest.fn(),
    getSwimmersBySquad: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsService,
        {
          provide: SquadsRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SquadsService>(SquadsService);
    _repository = module.get<SquadsRepository>(SquadsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new squad', async () => {
      const createSquadDto: CreateSquadDto = {
        squad_name: 'Juniors',
        min_age: 8,
        max_age: 12,
      };

      mockRepository.create.mockResolvedValue(mockSquad);

      const result = await service.create(createSquadDto);

      expect(result.squad_name).toBe('Juniors');
      expect(mockRepository.create).toHaveBeenCalledWith(createSquadDto);
    });

    it('should throw BadRequestException when min_age exceeds max_age', async () => {
      const createSquadDto: CreateSquadDto = {
        squad_name: 'Seniors',
        min_age: 18,
        max_age: 12,
      };

      await expect(service.create(createSquadDto)).rejects.toThrow(BadRequestException);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should create a squad without age constraints', async () => {
      const createSquadDto: CreateSquadDto = {
        squad_name: 'Open Squad',
      };
      const squadWithoutAges = {
        ...mockSquad,
        squad_name: 'Open Squad',
        min_age: null,
        max_age: null,
      };

      mockRepository.create.mockResolvedValue(squadWithoutAges);

      const result = await service.create(createSquadDto);

      expect(result.squad_name).toBe('Open Squad');
      expect(mockRepository.create).toHaveBeenCalledWith(createSquadDto);
    });
  });

  describe('bulkCreate', () => {
    it('should create all squads when every row is valid', async () => {
      const dtos: CreateSquadDto[] = [
        { squad_name: 'Juniors', min_age: 8, max_age: 12 },
        { squad_name: 'Seniors', min_age: 13, max_age: 18 },
      ];

      mockRepository.findAllNames.mockResolvedValue([]);
      mockRepository.create
        .mockResolvedValueOnce({ ...mockSquad, squad_name: 'Juniors' })
        .mockResolvedValueOnce({ ...mockSquad, squad_id: 'other-id', squad_name: 'Seniors' });

      const result = await service.bulkCreate(dtos);

      expect(result.created).toHaveLength(2);
      expect(result.errors).toEqual([]);
      expect(mockRepository.create).toHaveBeenCalledTimes(2);
      expect(mockRepository.create).toHaveBeenNthCalledWith(1, dtos[0]);
      expect(mockRepository.create).toHaveBeenNthCalledWith(2, dtos[1]);
    });

    it('should reject in-payload duplicate names case-insensitively', async () => {
      const dtos: CreateSquadDto[] = [{ squad_name: 'Juniors' }, { squad_name: 'JUNIORS' }];

      mockRepository.findAllNames.mockResolvedValue([]);
      mockRepository.create.mockResolvedValue({ ...mockSquad, squad_name: 'Juniors' });

      const result = await service.bulkCreate(dtos);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toEqual([
        { row: 2, message: 'A squad named "JUNIORS" already exists' },
      ]);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should reject names that duplicate existing squads case-insensitively', async () => {
      const dtos: CreateSquadDto[] = [{ squad_name: 'juniors' }];

      mockRepository.findAllNames.mockResolvedValue([
        { squad_id: mockSquad.squad_id, squad_name: mockSquad.squad_name },
      ]);

      const result = await service.bulkCreate(dtos);

      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([
        { row: 1, message: 'A squad named "juniors" already exists' },
      ]);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should continue processing after a row fails and report partial success', async () => {
      const dtos: CreateSquadDto[] = [
        { squad_name: 'Juniors', min_age: 8, max_age: 12 },
        { squad_name: 'Broken', min_age: 18, max_age: 12 },
        { squad_name: 'Seniors' },
      ];

      mockRepository.findAllNames.mockResolvedValue([]);
      mockRepository.create
        .mockResolvedValueOnce({ ...mockSquad, squad_name: 'Juniors' })
        .mockResolvedValueOnce({ ...mockSquad, squad_id: 'other-id', squad_name: 'Seniors' });

      const result = await service.bulkCreate(dtos);

      expect(result.created).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(2);
      expect(result.errors[0].message).toBe('Minimum age cannot be greater than maximum age');
      expect(mockRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return all squads with swimmer_count', async () => {
      const squadsWithSwimmers = [
        { ...mockSquad, swimmers: [mockSwimmer, mockSwimmer] },
        { ...mockSquad, squad_id: 'other-id', squad_name: 'Seniors', swimmers: [] },
      ];

      mockRepository.findAll.mockResolvedValue(squadsWithSwimmers);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect((result[0] as unknown as Record<string, unknown>).swimmer_count).toBe(2);
      expect((result[1] as unknown as Record<string, unknown>).swimmer_count).toBe(0);
    });

    it('should return an empty array when no squads exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single squad with swimmer_count', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockSquad, swimmers: [mockSwimmer] });

      const result = await service.findOne(mockSquad.squad_id);

      expect(result.squad_id).toBe(mockSquad.squad_id);
      expect((result as unknown as Record<string, unknown>).swimmer_count).toBe(1);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a squad successfully', async () => {
      const updateDto: UpdateSquadDto = { squad_name: 'Advanced Juniors' };
      const updatedSquad = { ...mockSquad, squad_name: 'Advanced Juniors', swimmers: [] };

      mockRepository.findOne.mockResolvedValue(mockSquad);
      mockRepository.update.mockResolvedValue(updatedSquad);

      const result = await service.update(mockSquad.squad_id, updateDto);

      expect(result.squad_name).toBe('Advanced Juniors');
      expect(mockRepository.update).toHaveBeenCalledWith(mockSquad.squad_id, updateDto);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { squad_name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if updated age range is invalid', async () => {
      const squadWithAges = { ...mockSquad, min_age: 8, max_age: 12 };
      // Set max_age to something smaller than existing min_age
      const updateDto: UpdateSquadDto = { max_age: 5 };

      mockRepository.findOne.mockResolvedValue(squadWithAges);

      await expect(service.update(mockSquad.squad_id, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a squad', async () => {
      mockRepository.findOne.mockResolvedValue(mockSquad);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockSquad.squad_id);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockSquad.squad_id);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignSwimmer', () => {
    it('should assign a swimmer to a squad', async () => {
      const squadWithCapacity = { ...mockSquad, max_capacity: 20, swimmers: [] };
      const updatedSquad = { ...squadWithCapacity, swimmers: [mockSwimmer] };

      mockRepository.findOne.mockResolvedValue(squadWithCapacity);
      mockRepository.assignSwimmer.mockResolvedValue(updatedSquad);

      const result = await service.assignSwimmer(mockSquad.squad_id, mockSwimmer.swimmer_id);

      expect((result as unknown as Record<string, unknown>).swimmer_count).toBe(1);
      expect(mockRepository.assignSwimmer).toHaveBeenCalledWith(
        mockSquad.squad_id,
        mockSwimmer.swimmer_id,
      );
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.assignSwimmer('non-existent-id', mockSwimmer.swimmer_id),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when squad is at full capacity', async () => {
      const fullSquad = {
        ...mockSquad,
        max_capacity: 2,
        swimmers: [mockSwimmer, mockSwimmer],
      };

      mockRepository.findOne.mockResolvedValue(fullSquad);

      await expect(service.assignSwimmer(mockSquad.squad_id, 'new-swimmer-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if swimmer does not exist', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockSquad, swimmers: [] });
      mockRepository.assignSwimmer.mockResolvedValue(null);

      await expect(
        service.assignSwimmer(mockSquad.squad_id, 'non-existent-swimmer'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeSwimmer', () => {
    it('should remove a swimmer from a squad', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockSquad, swimmers: [mockSwimmer] });
      mockRepository.removeSwimmer.mockResolvedValue({ ...mockSquad, swimmers: [] });

      const result = await service.removeSwimmer(mockSquad.squad_id, mockSwimmer.swimmer_id);

      expect((result as unknown as Record<string, unknown>).swimmer_count).toBe(0);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeSwimmer('non-existent-id', mockSwimmer.swimmer_id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSwimmersBySquad', () => {
    it('should return swimmers belonging to a squad', async () => {
      mockRepository.findOne.mockResolvedValue(mockSquad);
      mockRepository.getSwimmersBySquad.mockResolvedValue([mockSwimmer]);

      const result = await service.getSwimmersBySquad(mockSquad.squad_id);

      expect(result).toEqual([mockSwimmer]);
      expect(mockRepository.getSwimmersBySquad).toHaveBeenCalledWith(mockSquad.squad_id);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getSwimmersBySquad('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatistics', () => {
    it('should return squad statistics', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getStatistics();

      expect(result).toEqual({ total: 5 });
      expect(mockRepository.count).toHaveBeenCalled();
    });
  });
});
