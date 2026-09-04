import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CompetitionsRepository } from './competitions.repository';
import { PersonalBestsService } from './personal-bests.service';
import { CompetitionType, CompetitionStatus, CourseType } from './entities/competition.entity';

describe('CompetitionsService', () => {
  let service: CompetitionsService;

  const mockCompetition = {
    competition_id: '123e4567-e89b-12d3-a456-426614174000',
    club_id: null,
    name: 'Kent County Championships 2026',
    organiser: 'Kent County ASA',
    venue: 'Larkfield Leisure Centre',
    start_date: new Date('2026-05-15'),
    end_date: null,
    type: CompetitionType.COUNTY,
    course: CourseType.LC,
    status: CompetitionStatus.DRAFT,
    entry_deadline: null,
    created_at: new Date(),
    updated_at: new Date(),
    entries: [],
    results: [],
  };

  const mockRepository = {
    createCompetition: jest.fn(),
    findAllCompetitions: jest.fn(),
    findCompetitionById: jest.fn(),
    updateCompetition: jest.fn(),
    removeCompetition: jest.fn(),
    createEntries: jest.fn(),
    findEntriesByCompetition: jest.fn(),
    findResultsByCompetition: jest.fn(),
    createResult: jest.fn(),
    findResultById: jest.fn(),
    updateResult: jest.fn(),
    removeResult: jest.fn(),
  };

  const mockPersonalBests = {
    getForSwimmer: jest.fn(),
    getSeasonBests: jest.fn(),
    recomputeForSwimmer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetitionsService,
        {
          provide: CompetitionsRepository,
          useValue: mockRepository,
        },
        {
          provide: PersonalBestsService,
          useValue: mockPersonalBests,
        },
      ],
    }).compile();

    service = module.get<CompetitionsService>(CompetitionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new competition', async () => {
      const dto = {
        name: 'Kent County Championships 2026',
        start_date: '2026-05-15',
        type: CompetitionType.COUNTY,
      };

      mockRepository.createCompetition.mockResolvedValue(mockCompetition);

      const result = await service.create(dto);
      expect(result).toEqual(mockCompetition);
      expect(mockRepository.createCompetition).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return an array of competitions', async () => {
      mockRepository.findAllCompetitions.mockResolvedValue([mockCompetition]);

      const result = await service.findAll();
      expect(result).toEqual([mockCompetition]);
    });
  });

  describe('findOne', () => {
    it('should return a single competition', async () => {
      mockRepository.findCompetitionById.mockResolvedValue(mockCompetition);

      const result = await service.findOne(mockCompetition.competition_id);
      expect(result).toEqual(mockCompetition);
    });

    it('should throw NotFoundException if competition not found', async () => {
      mockRepository.findCompetitionById.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a competition', async () => {
      const updated = { ...mockCompetition, name: 'Updated Name' };
      mockRepository.findCompetitionById.mockResolvedValue(mockCompetition);
      mockRepository.updateCompetition.mockResolvedValue(updated);

      const result = await service.update(mockCompetition.competition_id, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if competition not found', async () => {
      mockRepository.findCompetitionById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a competition', async () => {
      mockRepository.findCompetitionById.mockResolvedValue(mockCompetition);
      mockRepository.removeCompetition.mockResolvedValue(undefined);

      await service.remove(mockCompetition.competition_id);
      expect(mockRepository.removeCompetition).toHaveBeenCalledWith(mockCompetition.competition_id);
    });

    it('should throw NotFoundException if competition not found', async () => {
      mockRepository.findCompetitionById.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addEntries', () => {
    it('should add entries to a competition', async () => {
      const entries = [
        {
          swimmer_id: 'swimmer-1',
          distance: 50,
          stroke: 'Freestyle',
          entry_time: 35.5,
        },
      ];

      const mockEntries = entries.map((e, i) => ({
        entry_id: `entry-${i}`,
        competition_id: mockCompetition.competition_id,
        ...e,
        event_name: null,
        seed_time: null,
        status: 'pending',
        created_at: new Date(),
      }));

      mockRepository.findCompetitionById.mockResolvedValue(mockCompetition);
      mockRepository.createEntries.mockResolvedValue(mockEntries);

      const result = await service.addEntries(mockCompetition.competition_id, entries);
      expect(result).toHaveLength(1);
    });
  });

  describe('getResults', () => {
    it('should return results for a competition', async () => {
      const mockResults = [
        {
          result_id: 'result-1',
          competition_id: mockCompetition.competition_id,
          swimmer_id: 'swimmer-1',
          distance: 50,
          stroke: 'Freestyle',
          time: 34.56,
          place: 1,
          dq: false,
          is_pb: true,
        },
      ];

      mockRepository.findCompetitionById.mockResolvedValue(mockCompetition);
      mockRepository.findResultsByCompetition.mockResolvedValue(mockResults);

      const result = await service.getResults(mockCompetition.competition_id);
      expect(result).toHaveLength(1);
      expect(result[0].is_pb).toBe(true);
    });
  });
});
