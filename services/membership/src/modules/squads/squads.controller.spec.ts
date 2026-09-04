import { Test, TestingModule } from '@nestjs/testing';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';
import { CreateSquadDto } from './dto/create-squad.dto';
import { UpdateSquadDto } from './dto/update-squad.dto';
import { AssignSwimmerDto } from './dto/assign-swimmer.dto';
import { BulkCreateSquadDto } from './dto/bulk-create-squad.dto';

describe('SquadsController', () => {
  let controller: SquadsController;
  let _service: SquadsService;

  const mockSquad = {
    squad_id: '223e4567-e89b-12d3-a456-426614174001',
    squad_name: 'Juniors',
    description: 'Junior development squad',
    min_age: 8,
    max_age: 12,
    coach_name: 'Sarah Jones',
    training_times: 'Monday 17:00, Wednesday 17:00',
    max_capacity: 20,
    swimmer_count: 0,
    swimmers: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSwimmer = {
    swimmer_id: '123e4567-e89b-12d3-a456-426614174000',
    first_name: 'Tom',
    last_name: 'Brown',
  };

  const mockService = {
    create: jest.fn(),
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    assignSwimmer: jest.fn(),
    removeSwimmer: jest.fn(),
    getSwimmersBySquad: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SquadsController],
      providers: [
        {
          provide: SquadsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SquadsController>(SquadsController);
    _service = module.get<SquadsService>(SquadsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the correct DTO', async () => {
      const createSquadDto: CreateSquadDto = {
        squad_name: 'Juniors',
        min_age: 8,
        max_age: 12,
      };

      mockService.create.mockResolvedValue(mockSquad);

      const result = await controller.create(createSquadDto);

      expect(result).toEqual(mockSquad);
      expect(mockService.create).toHaveBeenCalledWith(createSquadDto);
    });
  });

  describe('bulkCreate', () => {
    it('should call service.bulkCreate with the squads array', async () => {
      const squads: CreateSquadDto[] = [
        { squad_name: 'Juniors', min_age: 8, max_age: 12 },
        { squad_name: 'Seniors', min_age: 13, max_age: 18 },
      ];
      const bulkDto: BulkCreateSquadDto = { squads };
      const bulkResult = { created: [mockSquad], errors: [] };

      mockService.bulkCreate.mockResolvedValue(bulkResult);

      const result = await controller.bulkCreate(bulkDto);

      expect(result).toEqual(bulkResult);
      expect(mockService.bulkCreate).toHaveBeenCalledWith(squads);
    });
  });

  describe('findAll', () => {
    it('should return all squads', async () => {
      mockService.findAll.mockResolvedValue([mockSquad]);

      const result = await controller.findAll();

      expect(result).toEqual([mockSquad]);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('getStatistics', () => {
    it('should return squad statistics', async () => {
      mockService.getStatistics.mockResolvedValue({ total: 3 });

      const result = await controller.getStatistics();

      expect(result).toEqual({ total: 3 });
    });
  });

  describe('findOne', () => {
    it('should return a single squad by ID', async () => {
      mockService.findOne.mockResolvedValue(mockSquad);

      const result = await controller.findOne(mockSquad.squad_id);

      expect(result).toEqual(mockSquad);
      expect(mockService.findOne).toHaveBeenCalledWith(mockSquad.squad_id);
    });
  });

  describe('getSwimmers', () => {
    it('should return swimmers in the specified squad', async () => {
      mockService.getSwimmersBySquad.mockResolvedValue([mockSwimmer]);

      const result = await controller.getSwimmers(mockSquad.squad_id);

      expect(result).toEqual([mockSwimmer]);
      expect(mockService.getSwimmersBySquad).toHaveBeenCalledWith(mockSquad.squad_id);
    });
  });

  describe('update', () => {
    it('should call service.update with the correct arguments', async () => {
      const updateDto: UpdateSquadDto = { squad_name: 'Elite Juniors' };
      const updatedSquad = { ...mockSquad, squad_name: 'Elite Juniors' };

      mockService.update.mockResolvedValue(updatedSquad);

      const result = await controller.update(mockSquad.squad_id, updateDto);

      expect(result).toEqual(updatedSquad);
      expect(mockService.update).toHaveBeenCalledWith(mockSquad.squad_id, updateDto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with the correct ID', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove(mockSquad.squad_id);

      expect(mockService.remove).toHaveBeenCalledWith(mockSquad.squad_id);
    });
  });

  describe('assignSwimmer', () => {
    it('should assign a swimmer to the squad', async () => {
      const assignDto: AssignSwimmerDto = { swimmer_id: mockSwimmer.swimmer_id };
      const updatedSquad = { ...mockSquad, swimmer_count: 1, swimmers: [mockSwimmer] };

      mockService.assignSwimmer.mockResolvedValue(updatedSquad);

      const result = await controller.assignSwimmer(mockSquad.squad_id, assignDto);

      expect(result).toEqual(updatedSquad);
      expect(mockService.assignSwimmer).toHaveBeenCalledWith(
        mockSquad.squad_id,
        mockSwimmer.swimmer_id,
      );
    });
  });

  describe('removeSwimmer', () => {
    it('should remove a swimmer from the squad', async () => {
      const updatedSquad = { ...mockSquad, swimmer_count: 0, swimmers: [] };

      mockService.removeSwimmer.mockResolvedValue(updatedSquad);

      const result = await controller.removeSwimmer(mockSquad.squad_id, mockSwimmer.swimmer_id);

      expect(result).toEqual(updatedSquad);
      expect(mockService.removeSwimmer).toHaveBeenCalledWith(
        mockSquad.squad_id,
        mockSwimmer.swimmer_id,
      );
    });
  });
});
