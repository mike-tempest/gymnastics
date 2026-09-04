import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { FeeStructuresRepository } from './fee-structures.repository';
import { FeeStructure, FeeFrequency, AppliesToType } from './entities/fee-structure.entity';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { BulkFeeStructureItemDto } from './dto/bulk-create-fee-structure.dto';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { SquadsRepository } from '../../squads/squads.repository';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

describe('FeeStructuresService', () => {
  let service: FeeStructuresService;
  let _repository: FeeStructuresRepository;

  const CLUB_ID = '999e0000-e89b-12d3-a456-426614174099';

  const mockFeeStructure: Partial<FeeStructure> = {
    fee_structure_id: '778e9012-e89b-12d3-a456-426614174005',
    name: 'Monthly Squad Fee',
    description: 'Standard monthly fee for squad members',
    amount: 45.0,
    currency: 'GBP',
    frequency: FeeFrequency.MONTHLY,
    applies_to_type: AppliesToType.SQUAD,
    applies_to_id: '223e4567-e89b-12d3-a456-426614174001',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findActive: jest.fn(),
    findByType: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  const mockSquadsRepository = {
    findAllNames: jest.fn(),
  };

  const mockTenantContext = {
    getClubId: jest.fn().mockReturnValue(CLUB_ID),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeStructuresService,
        { provide: FeeStructuresRepository, useValue: mockRepository },
        { provide: ClubsRepository, useValue: mockClubsRepository },
        { provide: SquadsRepository, useValue: mockSquadsRepository },
        { provide: TenantContextService, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<FeeStructuresService>(FeeStructuresService);
    _repository = module.get<FeeStructuresRepository>(FeeStructuresRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new fee structure in the club currency', async () => {
      const createDto = {
        name: 'Annual Registration Fee',
        amount: 30.0,
        frequency: FeeFrequency.ANNUAL,
        applies_to_type: AppliesToType.CLUB,
      };

      mockClubsRepository.findOne.mockResolvedValue({ id: CLUB_ID, currency: 'GBP' });
      mockRepository.create.mockResolvedValue({ ...mockFeeStructure, ...createDto });

      const result = await service.create(createDto as CreateFeeStructureDto);

      expect(result).toBeDefined();
      // The owning club's currency is resolved and passed to the repository.
      expect(mockRepository.create).toHaveBeenCalledWith(createDto, 'GBP');
    });

    it('should stamp a non-GBP club currency onto the fee structure', async () => {
      const createDto = {
        name: 'Monthly Squad Fee',
        amount: 60.0,
        frequency: FeeFrequency.MONTHLY,
        applies_to_type: AppliesToType.CLUB,
      };

      mockClubsRepository.findOne.mockResolvedValue({ id: CLUB_ID, currency: 'USD' });
      mockRepository.create.mockResolvedValue({
        ...mockFeeStructure,
        ...createDto,
        currency: 'USD',
      });

      await service.create(createDto as CreateFeeStructureDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto, 'USD');
    });

    it('should fall back to GBP when the club has no currency', async () => {
      const createDto = {
        name: 'One-off Fee',
        amount: 15.0,
        frequency: FeeFrequency.ONE_TIME,
        applies_to_type: AppliesToType.CLUB,
      };

      // Club lookup returns null (defensive fallback path).
      mockClubsRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({ ...mockFeeStructure, ...createDto });

      await service.create(createDto as CreateFeeStructureDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto, 'GBP');
    });
  });

  describe('bulkCreate', () => {
    const SQUAD_ID = '223e4567-e89b-12d3-a456-426614174001';

    const mockSquads = [
      { squad_id: SQUAD_ID, squad_name: 'Junior Development', club_id: CLUB_ID },
      { squad_id: '334e4567-e89b-12d3-a456-426614174002', squad_name: 'Masters', club_id: CLUB_ID },
    ];

    beforeEach(() => {
      mockClubsRepository.findOne.mockResolvedValue({ id: CLUB_ID, currency: 'GBP' });
      mockRepository.create.mockImplementation((dto: CreateFeeStructureDto) =>
        Promise.resolve({ ...mockFeeStructure, ...dto }),
      );
    });

    it('should create a club-level fee with a null squad reference', async () => {
      const items = [
        {
          name: 'Annual Registration',
          amount: 30.0,
          frequency: FeeFrequency.ANNUAL,
          applies_to_type: AppliesToType.CLUB,
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toEqual([]);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Annual Registration',
          applies_to_type: AppliesToType.CLUB,
          applies_to_id: undefined,
        }),
        'GBP',
      );
      // No squad rows in the batch, so squads are never fetched.
      expect(mockSquadsRepository.findAllNames).not.toHaveBeenCalled();
    });

    it('should ignore a provided squad_name for club-level fees', async () => {
      const items = [
        {
          name: 'Club Levy',
          amount: 10.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.CLUB,
          squad_name: 'Masters',
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toEqual([]);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ applies_to_id: undefined }),
        'GBP',
      );
    });

    it('should resolve a squad fee by name case-insensitively', async () => {
      mockSquadsRepository.findAllNames.mockResolvedValue(mockSquads);

      const items = [
        {
          name: 'Squad Fee',
          amount: 45.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.SQUAD,
          squad_name: 'junior development',
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toEqual([]);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          applies_to_type: AppliesToType.SQUAD,
          applies_to_id: SQUAD_ID,
        }),
        'GBP',
      );
    });

    it('should record a row error for an unknown squad name', async () => {
      mockSquadsRepository.findAllNames.mockResolvedValue(mockSquads);

      const items = [
        {
          name: 'Squad Fee',
          amount: 45.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.SQUAD,
          squad_name: 'Nonexistent Squad',
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([
        { row: 1, message: 'Squad "Nonexistent Squad" not found' },
      ]);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should record a row error when squad_name is missing for a squad fee', async () => {
      mockSquadsRepository.findAllNames.mockResolvedValue(mockSquads);

      const items = [
        {
          name: 'Squad Fee',
          amount: 45.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.SQUAD,
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([
        { row: 1, message: 'squad_name is required when applies_to_type is squad' },
      ]);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should record a row error for a negative amount', async () => {
      const items = [
        {
          name: 'Bad Fee',
          amount: -5.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.CLUB,
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([{ row: 1, message: 'Amount must be a non-negative number' }]);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should continue processing after bad rows and report partial success', async () => {
      mockSquadsRepository.findAllNames.mockResolvedValue(mockSquads);

      const items = [
        {
          name: 'Club Fee',
          amount: 20.0,
          frequency: FeeFrequency.ANNUAL,
          applies_to_type: AppliesToType.CLUB,
        },
        {
          name: 'Unknown Squad Fee',
          amount: 40.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.SQUAD,
          squad_name: 'Ghost Squad',
        },
        {
          name: 'Masters Fee',
          amount: 50.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.SQUAD,
          squad_name: 'MASTERS',
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toHaveLength(2);
      expect(result.errors).toEqual([{ row: 2, message: 'Squad "Ghost Squad" not found' }]);
    });

    it('should record a row error when the underlying create fails and keep going', async () => {
      mockRepository.create
        .mockRejectedValueOnce(new Error('Database connection lost'))
        .mockImplementation((dto: CreateFeeStructureDto) =>
          Promise.resolve({ ...mockFeeStructure, ...dto }),
        );

      const items = [
        {
          name: 'First Fee',
          amount: 10.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.CLUB,
        },
        {
          name: 'Second Fee',
          amount: 15.0,
          frequency: FeeFrequency.MONTHLY,
          applies_to_type: AppliesToType.CLUB,
        },
      ] as BulkFeeStructureItemDto[];

      const result = await service.bulkCreate(items);

      expect(result.created).toHaveLength(1);
      expect(result.errors).toEqual([{ row: 1, message: 'Database connection lost' }]);
    });
  });

  describe('findAll', () => {
    it('should return all fee structures', async () => {
      mockRepository.findAll.mockResolvedValue([mockFeeStructure]);

      const result = await service.findAll();

      expect(result).toEqual([mockFeeStructure]);
    });

    it('should return an empty array when no fee structures exist', async () => {
      mockRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findActive', () => {
    it('should return only active fee structures', async () => {
      mockRepository.findActive.mockResolvedValue([mockFeeStructure]);

      const result = await service.findActive();

      expect(result).toEqual([mockFeeStructure]);
      expect(mockRepository.findActive).toHaveBeenCalled();
    });
  });

  describe('findByType', () => {
    it('should return fee structures for a given applies_to_type', async () => {
      mockRepository.findByType.mockResolvedValue([mockFeeStructure]);

      const result = await service.findByType(AppliesToType.SQUAD);

      expect(result).toEqual([mockFeeStructure]);
      expect(mockRepository.findByType).toHaveBeenCalledWith(AppliesToType.SQUAD);
    });
  });

  describe('findOne', () => {
    it('should return a single fee structure', async () => {
      mockRepository.findOne.mockResolvedValue(mockFeeStructure);

      const result = await service.findOne(mockFeeStructure.fee_structure_id as string);

      expect(result).toEqual(mockFeeStructure);
    });

    it('should throw NotFoundException if fee structure does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a fee structure', async () => {
      const updateDto = { amount: 50.0 };
      const updatedFeeStructure = { ...mockFeeStructure, amount: 50.0 };

      mockRepository.findOne.mockResolvedValue(mockFeeStructure);
      mockRepository.update.mockResolvedValue(updatedFeeStructure);

      const result = await service.update(
        mockFeeStructure.fee_structure_id as string,
        updateDto as UpdateFeeStructureDto,
      );

      expect(result.amount).toBe(50.0);
    });

    it('should throw NotFoundException if fee structure does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { amount: 50.0 } as UpdateFeeStructureDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should deactivate a fee structure', async () => {
      const updateDto = { active: false };
      const deactivated = { ...mockFeeStructure, active: false };

      mockRepository.findOne.mockResolvedValue(mockFeeStructure);
      mockRepository.update.mockResolvedValue(deactivated);

      const result = await service.update(
        mockFeeStructure.fee_structure_id as string,
        updateDto as UpdateFeeStructureDto,
      );

      expect(result.active).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove a fee structure', async () => {
      mockRepository.findOne.mockResolvedValue(mockFeeStructure);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockFeeStructure.fee_structure_id as string);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockFeeStructure.fee_structure_id);
    });

    it('should throw NotFoundException if fee structure does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
