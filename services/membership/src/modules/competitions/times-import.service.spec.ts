import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TimesImportService } from './times-import.service';
import { CompetitionsRepository } from './competitions.repository';
import { PersonalBestsService } from './personal-bests.service';
import { SwimmersRepository } from '../swimmers/swimmers.repository';
import { CompetitionResult } from './entities/competition-result.entity';

describe('TimesImportService', () => {
  let service: TimesImportService;

  const mockSwimmers = [
    {
      swimmer_id: 'swimmer-1',
      se_number: '1234567',
      first_name: 'Kassidy',
      last_name: 'Tempest',
    },
    {
      swimmer_id: 'swimmer-2',
      se_number: '1234568',
      first_name: 'Emma',
      last_name: 'Johnson',
    },
    // Two swimmers sharing a name, to exercise the ambiguity error.
    { swimmer_id: 'swimmer-3', se_number: '1234569', first_name: 'Sam', last_name: 'Lee' },
    { swimmer_id: 'swimmer-4', se_number: '1234570', first_name: 'Sam', last_name: 'Lee' },
  ];

  const echoCreateResults = (results: Partial<CompetitionResult>[]) =>
    Promise.resolve(results.map((r, i) => ({ ...r, result_id: `result-${i}` })));

  const mockRepository = {
    findCompetitionById: jest.fn(),
    createResults: jest.fn(echoCreateResults),
    findResultsByIds: jest.fn(),
  };

  const mockSwimmersRepository = {
    findAll: jest.fn(),
  };

  const mockPersonalBests = {
    recomputeForSwimmer: jest.fn().mockResolvedValue({ improved: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimesImportService,
        { provide: CompetitionsRepository, useValue: mockRepository },
        { provide: SwimmersRepository, useValue: mockSwimmersRepository },
        { provide: PersonalBestsService, useValue: mockPersonalBests },
      ],
    }).compile();

    service = module.get<TimesImportService>(TimesImportService);
  });

  beforeEach(() => {
    mockRepository.findCompetitionById.mockResolvedValue({
      competition_id: 'comp-1',
      club_id: 'club-1',
      course: 'SC',
      start_date: new Date('2026-09-01'),
    });
    mockRepository.createResults.mockImplementation(echoCreateResults);
    mockRepository.findResultsByIds.mockImplementation((ids: string[]) =>
      Promise.resolve(ids.map((id) => ({ result_id: id, is_pb: true }))),
    );
    mockSwimmersRepository.findAll.mockResolvedValue(mockSwimmers);
    mockPersonalBests.recomputeForSwimmer.mockResolvedValue({ improved: 0 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('imports a sheet with multiple swimmers and multiple times each', async () => {
    const csv = [
      'registration_number,first_name,last_name,distance,stroke,time,course,date',
      '1234567,Kassidy,Tempest,50,Freestyle,34.20,SC,2026-05-12',
      '1234567,Kassidy,Tempest,100,Freestyle,1:16.80,SC,2026-06-01',
      '1234568,Emma,Johnson,100,Backstroke,1:22.40,LC,',
    ].join('\n');

    const outcome = await service.import('comp-1', csv);

    expect(outcome.imported).toBe(3);
    expect(outcome.errors).toHaveLength(0);
    expect(outcome.newPBs).toBe(3);

    const entities = mockRepository.createResults.mock.calls[0][0];
    expect(entities).toHaveLength(3);
    expect(entities[0]).toMatchObject({
      swimmer_id: 'swimmer-1',
      distance: 50,
      stroke: 'Freestyle',
      time: 34.2,
      course: 'SC',
    });
    expect(entities[0].swum_at).toEqual(new Date('2026-05-12'));
    expect(entities[1]).toMatchObject({ time: 76.8 });
    // Row course wins over the competition course; missing date stays null.
    expect(entities[2]).toMatchObject({ course: 'LC', swum_at: null });

    // PBs recomputed once per distinct swimmer.
    expect(mockPersonalBests.recomputeForSwimmer).toHaveBeenCalledTimes(2);
  });

  it('matches by name when no registration number is given', async () => {
    const csv = [
      'first_name,last_name,distance,stroke,time',
      'Emma,Johnson,50,Fly,38.90',
    ].join('\n');

    const outcome = await service.import('comp-1', csv);

    expect(outcome.imported).toBe(1);
    const entities = mockRepository.createResults.mock.calls[0][0];
    expect(entities[0]).toMatchObject({
      swimmer_id: 'swimmer-2',
      stroke: 'Butterfly',
    });
  });

  it('accepts stroke aliases and a combined event column', async () => {
    const csv = [
      'registration_number,event,time',
      '1234567,100m Free,1:10.00',
      '1234568,200 IM,2:45.10',
    ].join('\n');

    const preview = await service.preview('comp-1', csv);

    expect(preview.errors).toHaveLength(0);
    expect(preview.validRows).toHaveLength(2);
    expect(preview.validRows[0]).toMatchObject({ distance: 100, stroke: 'Freestyle' });
    expect(preview.validRows[1]).toMatchObject({ distance: 200, stroke: 'Individual Medley' });
  });

  it('reports row-level errors and imports the valid rows', async () => {
    const csv = [
      'registration_number,first_name,last_name,distance,stroke,time',
      '1234567,Kassidy,Tempest,50,Freestyle,34.20',
      '9999999,Missing,Person,50,Freestyle,40.00',
      ',Sam,Lee,50,Freestyle,39.00',
      '1234568,Emma,Johnson,50,Sidestroke,41.00',
      '1234568,Emma,Johnson,75,Freestyle,50.00',
      '1234568,Emma,Johnson,50,Freestyle,not-a-time',
    ].join('\n');

    const outcome = await service.import('comp-1', csv);

    expect(outcome.imported).toBe(1);
    expect(outcome.errors).toHaveLength(5);
    expect(outcome.errors.map((e) => e.row)).toEqual([3, 4, 5, 6, 7]);
    expect(outcome.errors[0].message).toContain('not found');
    expect(outcome.errors[1].message).toContain('More than one swimmer');
    expect(outcome.errors[2].message).toContain('Unrecognised stroke');
    expect(outcome.errors[3].message).toContain('Distance');
    expect(outcome.errors[4].message).toContain('could not be read');
  });

  it('rejects a file without a usable header row', async () => {
    const csv = ['who,what,when', 'a,b,c'].join('\n');

    await expect(service.preview('comp-1', csv)).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty file', async () => {
    await expect(service.preview('comp-1', 'time\n')).rejects.toThrow(BadRequestException);
  });

  it('behaves as not-found for a competition outside the club', async () => {
    mockRepository.findCompetitionById.mockResolvedValue(null);

    await expect(service.import('comp-other', 'a,b\n1,2')).rejects.toThrow(BadRequestException);
    expect(mockRepository.createResults).not.toHaveBeenCalled();
  });
});
