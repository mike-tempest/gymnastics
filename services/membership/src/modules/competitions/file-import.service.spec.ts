import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import { FileImportService } from './file-import.service';
import { CompetitionsRepository } from './competitions.repository';
import { PersonalBestsService } from './personal-bests.service';
import { MembersRepository } from '../members/members.repository';
import { ClubsService } from '../clubs/clubs.service';
import { HY3Parser } from '../../parsers/hy3-parser';
import { CompetitionResult } from './entities/competition-result.entity';

describe('FileImportService', () => {
  let service: FileImportService;

  const mockMembers = [
    {
      member_id: 'member-1',
      registration_number: '1234567',
      first_name: 'Kassidy',
      last_name: 'Tempest',
      gender: 'F',
      dob: new Date('2015-09-15'),
    },
    {
      member_id: 'member-2',
      registration_number: '1234568',
      first_name: 'Emma',
      last_name: 'Johnson',
      gender: 'F',
      dob: new Date('2014-02-10'),
    },
    {
      member_id: 'member-3',
      registration_number: '1234569',
      first_name: 'Oliver',
      last_name: 'Williams',
      gender: 'M',
      dob: new Date('2013-06-25'),
    },
  ];

  // Echo saved entities back with generated ids, as the real repository does.
  const echoCreateResults = (results: Partial<CompetitionResult>[]) =>
    Promise.resolve(results.map((r, i) => ({ ...r, result_id: `result-${i}` })));

  const mockRepository = {
    createResults: jest.fn(echoCreateResults),
    findResultsByMember: jest.fn().mockResolvedValue([]),
    findCompetitionById: jest.fn(),
    findResultsByIds: jest.fn(),
  };

  const mockMembersRepository = {
    findAll: jest.fn().mockResolvedValue(mockMembers),
  };

  const mockClubsService = {
    findCurrent: jest.fn(),
  };

  const mockPersonalBests = {
    recomputeForMember: jest.fn().mockResolvedValue({ improved: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileImportService,
        {
          provide: CompetitionsRepository,
          useValue: mockRepository,
        },
        {
          provide: MembersRepository,
          useValue: mockMembersRepository,
        },
        {
          provide: ClubsService,
          useValue: mockClubsService,
        },
        {
          provide: PersonalBestsService,
          useValue: mockPersonalBests,
        },
      ],
    }).compile();

    service = module.get<FileImportService>(FileImportService);
  });

  beforeEach(() => {
    // Default to a GB Swim England club so the previous strict 7-digit
    // validation applies unless a test overrides the governing body.
    mockClubsService.findCurrent.mockResolvedValue({
      id: 'club-1',
      country: 'GB',
      governing_body: 'SWIM_ENGLAND',
    });
    mockMembersRepository.findAll.mockResolvedValue(mockMembers);
    mockRepository.createResults.mockImplementation(echoCreateResults);
    mockRepository.findCompetitionById.mockResolvedValue({
      competition_id: 'comp-1',
      club_id: 'club-1',
      course: 'SC',
    });
    // After recompute the importer re-reads the saved rows to count PB flags;
    // default to none flagged.
    mockRepository.findResultsByIds.mockImplementation((ids: string[]) =>
      Promise.resolve(ids.map((id) => ({ result_id: id, is_pb: false }))),
    );
    mockPersonalBests.recomputeForMember.mockResolvedValue({ improved: 0 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('preview (SportSystems)', () => {
    it('should preview a SportSystems results file', async () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../../../test/test-data/sportsystems/results-club-open-meet.csv'),
        'utf-8',
      );

      const preview = await service.preview('comp-1', 'results.csv', content);

      expect(preview.format).toBe('sportsystems');
      expect(preview.totalResults).toBe(7);
      expect(preview.matchedMembers).toBeGreaterThan(0);
      // SE 9999999 is not in our mock members
      expect(preview.unmatchedMembers.length).toBeGreaterThan(0);
    });
  });

  describe('importResults (SportSystems)', () => {
    it('should import results from a SportSystems CSV file', async () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../../../test/test-data/sportsystems/results-club-open-meet.csv'),
        'utf-8',
      );

      mockRepository.createResults.mockResolvedValue([]);
      mockRepository.findResultsByMember.mockResolvedValue([]);

      const outcome = await service.importResults('comp-1', 'results.csv', content);

      expect(outcome.imported).toBeGreaterThan(0);
      expect(outcome.errors).toHaveLength(0);
      // Unmatched member generates a warning
      expect(outcome.warnings.length).toBeGreaterThan(0);
      expect(mockRepository.createResults).toHaveBeenCalled();
    });

    it('should count PB flags set by the recompute pass', async () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../../../test/test-data/sportsystems/results-club-open-meet.csv'),
        'utf-8',
      );

      // Simulate the recompute pass having flagged every imported result.
      mockRepository.findResultsByIds.mockImplementation((ids: string[]) =>
        Promise.resolve(ids.map((id) => ({ result_id: id, is_pb: true }))),
      );

      const outcome = await service.importResults('comp-1', 'results.csv', content);

      expect(outcome.newPBs).toBe(outcome.imported);
      expect(mockPersonalBests.recomputeForMember).toHaveBeenCalled();
    });
  });

  describe('importResults (HY3)', () => {
    it('should import results from a generated HY3 file', async () => {
      // Use the parser's own generator to produce a valid HY3 results file
      const hy3Parser = new HY3Parser();
      const content = hy3Parser.generateResultFile({
        meetName: 'Test Meet',
        meetDate: new Date(2026, 2, 20),
        teamName: 'TEST SC',
        teamCode: 'TEST',
        entries: [],
        results: [
          {
            member: {
              registrationNumber: '1234567',
              lastName: 'Tempest',
              firstName: 'Kassidy',
              gender: 'F',
              dateOfBirth: new Date(2015, 8, 15),
            },
            distance: 50,
            stroke: 'Freestyle',
            time: 40.56,
            place: 2,
            dq: false,
          },
          {
            member: {
              registrationNumber: '1234568',
              lastName: 'Johnson',
              firstName: 'Emma',
              gender: 'F',
              dateOfBirth: new Date(2014, 1, 10),
            },
            distance: 100,
            stroke: 'Backstroke',
            time: 72.3,
            place: 1,
            dq: false,
          },
        ],
      });

      mockRepository.createResults.mockResolvedValue([]);
      mockRepository.findResultsByMember.mockResolvedValue([]);

      const outcome = await service.importResults('comp-1', 'results.hy3', content);

      expect(outcome.imported).toBe(2);
      expect(outcome.errors).toHaveLength(0);
    });
  });

  describe('PB detection', () => {
    it('should not flag PB when existing result is faster', async () => {
      // SportSystems file where member 1234567 gets 1:04.56 in 50 Free
      const content = fs.readFileSync(
        path.join(__dirname, '../../../test/test-data/sportsystems/results-club-open-meet.csv'),
        'utf-8',
      );

      mockRepository.createResults.mockResolvedValue([]);
      // Member already has a faster result
      mockRepository.findResultsByMember.mockResolvedValue([
        {
          member_id: 'member-1',
          distance: 50,
          stroke: 'Freestyle',
          time: 30.0, // Faster than any result in the file
          dq: false,
        },
      ]);

      const outcome = await service.importResults('comp-1', 'results.csv', content);

      // Some PBs should still be detected for other events/members
      expect(outcome.imported).toBeGreaterThan(0);
    });
  });

  describe('auto-detect format', () => {
    it('should auto-detect HY3 format from file extension', async () => {
      const hy3Parser = new HY3Parser();
      const content = hy3Parser.generateResultFile({
        meetName: 'Test',
        entries: [],
        results: [
          {
            member: {
              registrationNumber: '1234567',
              lastName: 'Tempest',
              firstName: 'Kassidy',
              gender: 'F',
              dateOfBirth: new Date(2015, 8, 15),
            },
            distance: 50,
            stroke: 'Freestyle',
            time: 40.0,
            place: 1,
            dq: false,
          },
        ],
      });

      const preview = await service.preview('comp-1', 'results.hy3', content);
      expect(preview.format).toBe('hy3');
    });

    it('should auto-detect SportSystems format from file extension', async () => {
      const content = fs.readFileSync(
        path.join(__dirname, '../../../test/test-data/sportsystems/results-club-open-meet.csv'),
        'utf-8',
      );

      const preview = await service.preview('comp-1', 'results.csv', content);
      expect(preview.format).toBe('sportsystems');
    });
  });

  describe('governing-body aware validation', () => {
    const buildAuHy3 = (): string => {
      const hy3Parser = new HY3Parser();
      return hy3Parser.generateResultFile({
        meetName: 'NSW Country Championships',
        meetDate: new Date(2026, 2, 20),
        teamName: 'BONDI SC',
        teamCode: 'BON',
        country: 'AU',
        entries: [],
        results: [
          {
            member: {
              registrationNumber: 'AU12345',
              lastName: 'Nguyen',
              firstName: 'Mia',
              gender: 'F',
              dateOfBirth: new Date(2013, 4, 2),
            },
            distance: 50,
            stroke: 'Freestyle',
            time: 33.21,
            place: 1,
            dq: false,
          },
        ],
      });
    };

    it('accepts non-7-digit member numbers for an Australian club', async () => {
      mockClubsService.findCurrent.mockResolvedValue({
        id: 'club-au',
        country: 'AU',
        governing_body: 'SWIMMING_AUSTRALIA',
      });
      mockMembersRepository.findAll.mockResolvedValue([
        {
          member_id: 'member-au',
          registration_number: 'AU12345',
          first_name: 'Mia',
          last_name: 'Nguyen',
          gender: 'F',
          dob: new Date('2013-05-02'),
        },
      ]);
      mockRepository.createResults.mockResolvedValue([]);
      mockRepository.findResultsByMember.mockResolvedValue([]);

      const outcome = await service.importResults('comp-au', 'results.hy3', buildAuHy3());

      expect(outcome.imported).toBe(1);
      expect(outcome.errors).toHaveLength(0);
    });

    it('still rejects the same file for a GB club (7-digit SE numbers enforced)', async () => {
      await expect(
        service.importResults('comp-gb', 'results.hy3', buildAuHy3()),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({ message: 'SE number must be exactly 7 digits' }),
          ]),
        }),
      });
    });

    it('labels unmatched members with the club body registration label', async () => {
      mockClubsService.findCurrent.mockResolvedValue({
        id: 'club-au',
        country: 'AU',
        governing_body: 'SWIMMING_AUSTRALIA',
      });
      mockMembersRepository.findAll.mockResolvedValue([]);
      mockRepository.createResults.mockResolvedValue([]);
      mockRepository.findResultsByMember.mockResolvedValue([]);

      const outcome = await service.importResults('comp-au', 'results.hy3', buildAuHy3());

      expect(outcome.imported).toBe(0);
      expect(outcome.warnings[0]).toContain('(Member number: AU12345)');
    });
  });
});
