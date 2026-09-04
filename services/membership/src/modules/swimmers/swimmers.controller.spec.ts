import { Test, TestingModule } from '@nestjs/testing';
import { SwimmersController } from './swimmers.controller';
import { SwimmersService } from './swimmers.service';
import { CreateSwimmerDto } from './dto/create-swimmer.dto';
import { UpdateSwimmerDto } from './dto/update-swimmer.dto';
import { BulkCreateSwimmerDto } from './dto/bulk-create-swimmer.dto';

describe('SwimmersController', () => {
  let controller: SwimmersController;
  let _service: SwimmersService;

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
      controllers: [SwimmersController],
      providers: [
        {
          provide: SwimmersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<SwimmersController>(SwimmersController);
    _service = module.get<SwimmersService>(SwimmersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the correct DTO', async () => {
      const createSwimmerDto: CreateSwimmerDto = {
        first_name: 'John',
        last_name: 'Smith',
        dob: '2010-05-15',
        gender: 'M',
        se_number: '1234567',
      };

      mockService.create.mockResolvedValue(mockSwimmer);

      const result = await controller.create(createSwimmerDto);

      expect(result).toEqual(mockSwimmer);
      expect(mockService.create).toHaveBeenCalledWith(createSwimmerDto);
    });
  });

  describe('bulkCreate', () => {
    it('should call service.bulkCreate with the swimmers array', async () => {
      const swimmers: CreateSwimmerDto[] = [
        {
          first_name: 'John',
          last_name: 'Smith',
          dob: '2010-05-15',
          gender: 'M',
          se_number: '1234567',
        },
        {
          first_name: 'Amy',
          last_name: 'Brown',
          dob: '2011-03-22',
          gender: 'F',
          se_number: '7654321',
        },
      ];
      const bulkDto: BulkCreateSwimmerDto = { swimmers };
      const bulkResult = { created: [mockSwimmer], errors: [] };

      mockService.bulkCreate.mockResolvedValue(bulkResult);

      const result = await controller.bulkCreate(bulkDto);

      expect(result).toEqual(bulkResult);
      expect(mockService.bulkCreate).toHaveBeenCalledWith(swimmers);
    });
  });

  describe('findAll', () => {
    it('should return all swimmers when no query params are provided', async () => {
      mockService.findAll.mockResolvedValue([mockSwimmer]);

      const result = await controller.findAll();

      expect(result).toEqual([mockSwimmer]);
      expect(mockService.findAll).toHaveBeenCalled();
    });

    it('should filter by family_id when provided', async () => {
      const familyId = 'family-001';
      mockService.findByFamilyId.mockResolvedValue([mockSwimmer]);

      const result = await controller.findAll(familyId);

      expect(result).toEqual([mockSwimmer]);
      expect(mockService.findByFamilyId).toHaveBeenCalledWith(familyId);
      expect(mockService.findAll).not.toHaveBeenCalled();
    });

    it('should ignore a club_id query param and use the tenant context instead', async () => {
      // The controller no longer accepts ?club_id=; the param is intentionally
      // dropped so a caller cannot read another club's swimmers. findAll() is
      // already scoped to the active club via the tenant context.
      mockService.findAll.mockResolvedValue([mockSwimmer]);

      const result = await controller.findAll();

      expect(result).toEqual([mockSwimmer]);
      expect(mockService.findAll).toHaveBeenCalled();
      expect(mockService.findByClubId).not.toHaveBeenCalled();
    });

    it('should filter by squad_id when provided', async () => {
      const squadId = 'squad-001';
      mockService.findBySquadId.mockResolvedValue([mockSwimmer]);

      const result = await controller.findAll(undefined, squadId);

      expect(result).toEqual([mockSwimmer]);
      expect(mockService.findBySquadId).toHaveBeenCalledWith(squadId);
    });
  });

  describe('getStatistics', () => {
    it('should return swimmer statistics', async () => {
      mockService.getStatistics.mockResolvedValue({ total: 42 });

      const result = await controller.getStatistics();

      expect(result).toEqual({ total: 42 });
    });
  });

  describe('findOne', () => {
    it('should return a single swimmer by ID', async () => {
      mockService.findOne.mockResolvedValue(mockSwimmer);

      const result = await controller.findOne(mockSwimmer.swimmer_id);

      expect(result).toEqual(mockSwimmer);
      expect(mockService.findOne).toHaveBeenCalledWith(mockSwimmer.swimmer_id);
    });
  });

  describe('update', () => {
    it('should call service.update with the correct arguments', async () => {
      const updateDto: UpdateSwimmerDto = { first_name: 'Jonathan' };
      const updatedSwimmer = { ...mockSwimmer, first_name: 'Jonathan' };

      mockService.update.mockResolvedValue(updatedSwimmer);

      const result = await controller.update(mockSwimmer.swimmer_id, updateDto);

      expect(result).toEqual(updatedSwimmer);
      expect(mockService.update).toHaveBeenCalledWith(mockSwimmer.swimmer_id, updateDto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with the correct ID', async () => {
      mockService.remove.mockResolvedValue(undefined);

      await controller.remove(mockSwimmer.swimmer_id);

      expect(mockService.remove).toHaveBeenCalledWith(mockSwimmer.swimmer_id);
    });
  });
});
