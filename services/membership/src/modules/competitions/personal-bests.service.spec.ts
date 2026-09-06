import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PersonalBestsService } from './personal-bests.service';
import { PersonalBest } from './entities/personal-best.entity';
import { CompetitionResult } from './entities/competition-result.entity';
import { CourseType } from './entities/competition.entity';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';

const CLUB_ID = 'club-1';
const MEMBER_ID = 'member-1';

interface ResultSeed {
  result_id: string;
  time: number;
  startDate: string;
  distance?: number;
  stroke?: string;
  course?: CourseType | null;
  dq?: boolean;
  is_relay?: boolean;
  is_pb?: boolean;
}

function makeResult(seed: ResultSeed) {
  return {
    result_id: seed.result_id,
    club_id: CLUB_ID,
    competition_id: `comp-${seed.result_id}`,
    member_id: MEMBER_ID,
    event_name: null,
    distance: seed.distance ?? 100,
    stroke: seed.stroke ?? 'Freestyle',
    time: seed.time,
    place: null,
    heat: null,
    lane: null,
    dq: seed.dq ?? false,
    dq_reason: null,
    is_pb: seed.is_pb ?? false,
    splits: null,
    course: seed.course === undefined ? CourseType.SC : seed.course,
    is_relay: seed.is_relay ?? false,
    relay_legs: null,
    created_at: new Date(`${seed.startDate}T10:00:00Z`),
    competition: {
      competition_id: `comp-${seed.result_id}`,
      start_date: new Date(seed.startDate),
      course: CourseType.SC,
    },
  };
}

describe('PersonalBestsService', () => {
  let service: PersonalBestsService;

  const pbRepo = {
    update: jest.fn(),
    save: jest.fn(),
    create: jest.fn((data: Partial<PersonalBest>) => data),
    delete: jest.fn(),
  };
  const resultRepo = {
    update: jest.fn(),
  };
  const scoped = {
    scopedFind: jest.fn(),
  };
  const tenantContext = {
    getClubId: jest.fn().mockReturnValue(CLUB_ID),
  };

  /**
   * scopedFind is called first for results, then for existing PB rows; queue
   * the mock responses in that order.
   */
  function primeScopedFind(results: unknown[], existingPbs: unknown[]) {
    scoped.scopedFind.mockResolvedValueOnce(results).mockResolvedValueOnce(existingPbs);
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalBestsService,
        { provide: getRepositoryToken(PersonalBest), useValue: pbRepo },
        { provide: getRepositoryToken(CompetitionResult), useValue: resultRepo },
        { provide: TenantScopedHelper, useValue: scoped },
        { provide: TenantContextService, useValue: tenantContext },
      ],
    }).compile();

    service = module.get<PersonalBestsService>(PersonalBestsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recomputeForMember', () => {
    it('creates a PB row for the fastest eligible time of each event and course', async () => {
      primeScopedFind(
        [
          makeResult({ result_id: 'r1', time: 70.0, startDate: '2026-01-10' }),
          makeResult({ result_id: 'r2', time: 68.5, startDate: '2026-02-10' }),
          makeResult({ result_id: 'r3', time: 69.2, startDate: '2026-03-10' }),
        ],
        [],
      );

      const outcome = await service.recomputeForMember(MEMBER_ID);

      expect(outcome.improved).toBe(1);
      expect(pbRepo.save).toHaveBeenCalledTimes(1);
      expect(pbRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          club_id: CLUB_ID,
          member_id: MEMBER_ID,
          distance: 100,
          stroke: 'Freestyle',
          course: CourseType.SC,
          time: 68.5,
          result_id: 'r2',
        }),
      );
    });

    it('flags a result as PB only when it beat every earlier eligible time', async () => {
      primeScopedFind(
        [
          makeResult({ result_id: 'r1', time: 70.0, startDate: '2026-01-10' }),
          makeResult({ result_id: 'r2', time: 68.5, startDate: '2026-02-10' }),
          makeResult({ result_id: 'r3', time: 69.2, startDate: '2026-03-10', is_pb: true }),
        ],
        [],
      );

      await service.recomputeForMember(MEMBER_ID);

      // r1 and r2 were PBs when swum; r3 was not and its stale flag clears.
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'r1' }, { is_pb: true });
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'r2' }, { is_pb: true });
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'r3' }, { is_pb: false });
    });

    it('re-evaluates history when an older, faster meet is imported later', async () => {
      primeScopedFind(
        [
          // Imported second, but swum first and faster.
          makeResult({ result_id: 'old-meet', time: 66.0, startDate: '2025-11-01' }),
          makeResult({ result_id: 'recent', time: 68.5, startDate: '2026-02-10', is_pb: true }),
        ],
        [
          {
            pb_id: 'pb-1',
            club_id: CLUB_ID,
            member_id: MEMBER_ID,
            distance: 100,
            stroke: 'Freestyle',
            course: CourseType.SC,
            time: 68.5,
            result_id: 'recent',
          },
        ],
      );

      await service.recomputeForMember(MEMBER_ID);

      // The recent swim is no longer a PB and the stored row moves to the
      // genuinely fastest time.
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'recent' }, { is_pb: false });
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'old-meet' }, { is_pb: true });
      expect(pbRepo.update).toHaveBeenCalledWith(
        { pb_id: 'pb-1' },
        expect.objectContaining({ time: 66.0, result_id: 'old-meet' }),
      );
    });

    it('keeps short-course and long-course bests separate', async () => {
      primeScopedFind(
        [
          makeResult({
            result_id: 'sc',
            time: 68.5,
            startDate: '2026-01-10',
            course: CourseType.SC,
          }),
          makeResult({
            result_id: 'lc',
            time: 70.2,
            startDate: '2026-02-10',
            course: CourseType.LC,
          }),
        ],
        [],
      );

      const outcome = await service.recomputeForMember(MEMBER_ID);

      expect(outcome.improved).toBe(2);
      expect(pbRepo.save).toHaveBeenCalledTimes(2);
      // The slower LC swim still gets flagged: it is a PB within its course.
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'lc' }, { is_pb: true });
    });

    it('ignores DQs and relays, and clears stale PB flags on them', async () => {
      primeScopedFind(
        [
          makeResult({ result_id: 'ok', time: 68.5, startDate: '2026-01-10' }),
          makeResult({ result_id: 'dq', time: 0, startDate: '2026-02-10', dq: true, is_pb: true }),
          makeResult({ result_id: 'relay', time: 60.1, startDate: '2026-03-10', is_relay: true }),
        ],
        [],
      );

      await service.recomputeForMember(MEMBER_ID);

      expect(pbRepo.save).toHaveBeenCalledTimes(1);
      expect(pbRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ result_id: 'ok', time: 68.5 }),
      );
      expect(resultRepo.update).toHaveBeenCalledWith({ result_id: 'dq' }, { is_pb: false });
    });

    it('removes stored PBs whose backing results are gone', async () => {
      primeScopedFind(
        [],
        [
          {
            pb_id: 'pb-stale',
            club_id: CLUB_ID,
            member_id: MEMBER_ID,
            distance: 100,
            stroke: 'Freestyle',
            course: CourseType.SC,
            time: 68.5,
            result_id: 'deleted-result',
          },
        ],
      );

      await service.recomputeForMember(MEMBER_ID);

      expect(pbRepo.delete).toHaveBeenCalledWith(expect.objectContaining({ club_id: CLUB_ID }));
    });
  });

  describe('currentSeasonStart', () => {
    it('rolls to 1 September of the previous year before September', () => {
      expect(PersonalBestsService.currentSeasonStart(new Date('2026-08-02'))).toEqual(
        new Date(Date.UTC(2025, 8, 1)),
      );
    });

    it('uses 1 September of the current year from September onward', () => {
      expect(PersonalBestsService.currentSeasonStart(new Date('2026-10-15'))).toEqual(
        new Date(Date.UTC(2026, 8, 1)),
      );
    });
  });
});
