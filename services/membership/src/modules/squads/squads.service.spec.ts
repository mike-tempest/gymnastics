import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Discipline, SquadType } from '@club-manager/shared-types';
import { SquadsService } from './squads.service';
import { SquadsRepository } from './squads.repository';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { SquadCapacityEvents } from '../../common/capacity/squad-capacity.events';

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
    members: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockMember = {
    member_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'Tom',
    last_name: 'Brown',
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findAllNames: jest.fn(),
    findAllClassifications: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    assignMember: jest.fn(),
    removeMember: jest.fn(),
    getMembersBySquad: jest.fn(),
  };

  // The waiting list listens for freed places through this bus; the service
  // only publishes to it, so a recording double is enough here.
  const mockCapacityEvents = {
    emitPlaceMayHaveOpened: jest.fn().mockResolvedValue(undefined),
    onPlaceMayHaveOpened: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SquadsService,
        {
          provide: SquadsRepository,
          useValue: mockRepository,
        },
        {
          provide: SquadCapacityEvents,
          useValue: mockCapacityEvents,
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
    it('should return all squads with member_count', async () => {
      const squadsWithMembers = [
        { ...mockSquad, members: [mockMember, mockMember] },
        { ...mockSquad, squad_id: 'other-id', squad_name: 'Seniors', members: [] },
      ];

      mockRepository.findAll.mockResolvedValue(squadsWithMembers);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect((result[0] as unknown as Record<string, unknown>).member_count).toBe(2);
      expect((result[1] as unknown as Record<string, unknown>).member_count).toBe(0);
    });

    it('should return an empty array when no squads exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single squad with member_count', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockSquad, members: [mockMember] });

      const result = await service.findOne(mockSquad.squad_id);

      expect(result.squad_id).toBe(mockSquad.squad_id);
      expect((result as unknown as Record<string, unknown>).member_count).toBe(1);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a squad successfully', async () => {
      const updateDto: UpdateSquadDto = { squad_name: 'Advanced Juniors' };
      const updatedSquad = { ...mockSquad, squad_name: 'Advanced Juniors', members: [] };

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

  describe('assignMember', () => {
    it('should assign a member to a squad', async () => {
      const squadWithCapacity = { ...mockSquad, max_capacity: 20, members: [] };
      const updatedSquad = { ...squadWithCapacity, members: [mockMember] };

      mockRepository.findOne.mockResolvedValue(squadWithCapacity);
      mockRepository.assignMember.mockResolvedValue(updatedSquad);

      const result = await service.assignMember(mockSquad.squad_id, mockMember.member_id);

      expect((result as unknown as Record<string, unknown>).member_count).toBe(1);
      expect(mockRepository.assignMember).toHaveBeenCalledWith(
        mockSquad.squad_id,
        mockMember.member_id,
      );
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.assignMember('non-existent-id', mockMember.member_id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when squad is at full capacity', async () => {
      const fullSquad = {
        ...mockSquad,
        max_capacity: 2,
        members: [mockMember, mockMember],
      };

      mockRepository.findOne.mockResolvedValue(fullSquad);

      await expect(service.assignMember(mockSquad.squad_id, 'new-member-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if member does not exist', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockSquad, members: [] });
      mockRepository.assignMember.mockResolvedValue(null);

      await expect(service.assignMember(mockSquad.squad_id, 'non-existent-member')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeMember', () => {
    it('should remove a member from a squad', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockSquad, members: [mockMember] });
      mockRepository.removeMember.mockResolvedValue({ ...mockSquad, members: [] });

      const result = await service.removeMember(mockSquad.squad_id, mockMember.member_id);

      expect((result as unknown as Record<string, unknown>).member_count).toBe(0);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.removeMember('non-existent-id', mockMember.member_id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMembersBySquad', () => {
    it('should return members belonging to a squad', async () => {
      mockRepository.findOne.mockResolvedValue(mockSquad);
      mockRepository.getMembersBySquad.mockResolvedValue([mockMember]);

      const result = await service.getMembersBySquad(mockSquad.squad_id);

      expect(result).toEqual([mockMember]);
      expect(mockRepository.getMembersBySquad).toHaveBeenCalledWith(mockSquad.squad_id);
    });

    it('should throw NotFoundException if squad does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getMembersBySquad('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should split the total across squad type and discipline', async () => {
      mockRepository.findAllClassifications.mockResolvedValue([
        { squad_type: SquadType.RECREATIONAL, discipline: Discipline.WOMENS_ARTISTIC },
        { squad_type: SquadType.RECREATIONAL, discipline: Discipline.TRAMPOLINE },
        { squad_type: SquadType.COMPETITIVE, discipline: Discipline.WOMENS_ARTISTIC },
      ]);

      const result = await service.getStatistics();

      expect(mockRepository.findAllClassifications).toHaveBeenCalled();
      expect(result.total).toBe(3);
      expect(result.by_type[SquadType.RECREATIONAL]).toBe(2);
      expect(result.by_type[SquadType.COMPETITIVE]).toBe(1);
      expect(result.by_discipline[Discipline.WOMENS_ARTISTIC]).toBe(2);
      expect(result.by_discipline[Discipline.TRAMPOLINE]).toBe(1);
    });

    it('should list every squad type and discipline, zero included', async () => {
      mockRepository.findAllClassifications.mockResolvedValue([]);

      const result = await service.getStatistics();

      expect(result.total).toBe(0);
      for (const type of Object.values(SquadType)) {
        expect(result.by_type[type]).toBe(0);
      }
      for (const discipline of Object.values(Discipline)) {
        expect(result.by_discipline[discipline]).toBe(0);
      }
    });

    it('should count unclassified squads rather than dropping them', async () => {
      mockRepository.findAllClassifications.mockResolvedValue([
        { squad_type: null, discipline: null },
        { squad_type: SquadType.COMPETITIVE, discipline: null },
      ]);

      const result = await service.getStatistics();

      // The parts must always add up to the total, or a club whose squads are
      // half-classified sees numbers that do not reconcile.
      expect(result.total).toBe(2);
      expect(result.by_type.unclassified).toBe(1);
      expect(result.by_discipline.noDiscipline).toBe(2);
    });
  });
});
