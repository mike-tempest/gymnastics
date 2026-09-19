import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentOutcomeResult, AwardProgressStatus } from '@club-manager/shared-types';
import { AwardsService } from './awards.service';
import { AwardsRepository } from './awards.repository';
import { AwardBillingService } from './award-billing.service';
import { AwardSkillsService } from './award-skills.service';
import { MembersRepository } from '../members/members.repository';
import { AwardLevel } from './entities/award-level.entity';
import { Member } from '../members/entities/member.entity';
import { DEFAULT_AWARD_SCHEMES } from './awards.defaults';

const LEVEL_ID = 'level-1';
const SCHEME_ID = 'scheme-1';
const FAMILY_ID = 'family-1';

function makeLevel(overrides: Partial<AwardLevel> = {}): AwardLevel {
  return {
    level_id: LEVEL_ID,
    club_id: 'club-1',
    scheme_id: SCHEME_ID,
    name: 'Explore 3',
    description: null,
    sort_order: 3,
    badge_fee: 4.5,
    certificate_fee: null,
    fee_structure_id: null,
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
    scheme: { name: 'British Gymnastics Rise' },
    ...overrides,
  } as AwardLevel;
}

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    member_id: 'member-1',
    family_id: FAMILY_ID,
    club_id: 'club-1',
    first_name: 'Ava',
    last_name: 'Nolan',
    dob: '2016-04-02' as unknown as Date,
    registration_number: '1234567',
    ...overrides,
  } as Member;
}

describe('AwardsService', () => {
  let service: AwardsService;
  let awardsRepository: jest.Mocked<AwardsRepository>;
  let billing: jest.Mocked<AwardBillingService>;
  let membersRepository: jest.Mocked<MembersRepository>;

  beforeEach(async () => {
    const awardsRepositoryMock = {
      findAllSchemes: jest.fn().mockResolvedValue([]),
      findAllLevels: jest.fn().mockResolvedValue([]),
      findOneScheme: jest.fn().mockResolvedValue(null),
      findSchemeByName: jest.fn().mockResolvedValue(null),
      createScheme: jest.fn(),
      updateScheme: jest.fn(),
      removeScheme: jest.fn(),
      findLevelsByScheme: jest.fn().mockResolvedValue([]),
      findOneLevel: jest.fn().mockResolvedValue(null),
      createLevel: jest.fn(),
      updateLevel: jest.fn(),
      removeLevel: jest.fn(),
      findProgressByMember: jest.fn().mockResolvedValue([]),
      findProgressByMembers: jest.fn().mockResolvedValue([]),
      findOneProgress: jest.fn().mockResolvedValue(null),
      upsertProgress: jest.fn().mockImplementation((memberId, levelId, fields) =>
        Promise.resolve({
          progress_id: 'progress-1',
          member_id: memberId,
          level_id: levelId,
          ...fields,
        }),
      ),
      createEvent: jest.fn().mockResolvedValue({ event_id: 'event-1' }),
      createOutcome: jest.fn().mockResolvedValue({ outcome_id: 'outcome-1' }),
      updateOutcomeInvoice: jest.fn().mockResolvedValue(undefined),
      findEvents: jest.fn().mockResolvedValue([]),
      findOneEvent: jest.fn().mockResolvedValue(null),
    };

    const billingMock = {
      record: jest.fn().mockResolvedValue({ invoice_id: 'invoice-1' }),
    };

    const membersRepositoryMock = {
      findOne: jest.fn().mockResolvedValue(makeMember()),
      findAll: jest.fn().mockResolvedValue([makeMember()]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwardsService,
        { provide: AwardsRepository, useValue: awardsRepositoryMock },
        { provide: AwardBillingService, useValue: billingMock },
        {
          provide: AwardSkillsService,
          useValue: { updateLevel: jest.fn(), parentProgress: jest.fn() },
        },
        { provide: MembersRepository, useValue: membersRepositoryMock },
      ],
    }).compile();

    service = module.get(AwardsService);
    awardsRepository = module.get(AwardsRepository);
    billing = module.get(AwardBillingService);
    membersRepository = module.get(MembersRepository);
  });

  describe('scheme management', () => {
    it('rejects a scheme whose name is already taken in this club', async () => {
      awardsRepository.findSchemeByName.mockResolvedValue({ scheme_id: SCHEME_ID } as never);

      await expect(
        service.createScheme({ name: 'British Gymnastics Rise' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(awardsRepository.createScheme).not.toHaveBeenCalled();
    });

    it('refuses to attach a level to a scheme the club cannot see', async () => {
      awardsRepository.findOneScheme.mockResolvedValue(null);

      await expect(
        service.createLevel({ scheme_id: 'someone-elses-scheme', name: 'Explore 1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(awardsRepository.createLevel).not.toHaveBeenCalled();
    });

    it('refuses a rename onto a name this club already uses', async () => {
      awardsRepository.findOneScheme.mockResolvedValue({
        scheme_id: SCHEME_ID,
        name: 'Our own badges',
      } as never);
      awardsRepository.findSchemeByName.mockResolvedValue({ scheme_id: 'scheme-2' } as never);

      await expect(
        service.updateScheme(SCHEME_ID, { name: 'British Gymnastics Rise' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(awardsRepository.updateScheme).not.toHaveBeenCalled();
    });

    it('allows a save that leaves the name as it is', async () => {
      awardsRepository.findOneScheme.mockResolvedValue({
        scheme_id: SCHEME_ID,
        name: 'British Gymnastics Rise',
      } as never);
      awardsRepository.findSchemeByName.mockResolvedValue({ scheme_id: SCHEME_ID } as never);
      awardsRepository.updateScheme.mockResolvedValue({ scheme_id: SCHEME_ID } as never);

      await service.updateScheme(SCHEME_ID, { name: 'British Gymnastics Rise', active: false });

      expect(awardsRepository.updateScheme).toHaveBeenCalled();
    });
  });

  describe('listEvents', () => {
    it('clamps an outsized page request', async () => {
      await service.listEvents(undefined, 1_000_000);

      expect(awardsRepository.findEvents).toHaveBeenCalledWith(undefined, 200);
    });
  });

  describe('installDefaultSchemes', () => {
    it('writes every starter scheme and all of its levels as ordinary rows', async () => {
      awardsRepository.createScheme.mockImplementation((dto) =>
        Promise.resolve({ scheme_id: `scheme-${dto.name}`, ...dto } as never),
      );

      const result = await service.installDefaultSchemes();

      expect(result.installed).toEqual(DEFAULT_AWARD_SCHEMES.map((scheme) => scheme.name));
      expect(result.skipped).toEqual([]);
      expect(awardsRepository.createScheme).toHaveBeenCalledTimes(DEFAULT_AWARD_SCHEMES.length);

      const expectedLevels = DEFAULT_AWARD_SCHEMES.reduce(
        (total, scheme) => total + scheme.levels.length,
        0,
      );
      expect(awardsRepository.createLevel).toHaveBeenCalledTimes(expectedLevels);
    });

    it('skips a scheme the club already has rather than duplicating or overwriting it', async () => {
      awardsRepository.findSchemeByName.mockResolvedValue({ scheme_id: SCHEME_ID } as never);

      const result = await service.installDefaultSchemes();

      expect(result.installed).toEqual([]);
      expect(result.skipped).toEqual(DEFAULT_AWARD_SCHEMES.map((scheme) => scheme.name));
      expect(awardsRepository.createScheme).not.toHaveBeenCalled();
      expect(awardsRepository.createLevel).not.toHaveBeenCalled();
    });
  });

  describe('recordAssessment', () => {
    it('uses the transactional award service', async () => {
      const dto = {
        request_key: 'a4444444-4444-4444-8444-444444444444',
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      };
      await service.recordAssessment(dto, 'coach-1');
      expect(billing.record).toHaveBeenCalledWith(dto, 'coach-1');
    });
  });

  describe('Rise CSV export', () => {
    it('writes awarded badges with the Rise columns', async () => {
      awardsRepository.findAllSchemes.mockResolvedValue([
        { scheme_id: SCHEME_ID, name: 'British Gymnastics Rise' },
      ] as never);
      awardsRepository.findAllLevels.mockResolvedValue([makeLevel()] as never);
      awardsRepository.findProgressByMembers.mockResolvedValue([
        {
          member_id: 'member-1',
          level_id: LEVEL_ID,
          status: AwardProgressStatus.AWARDED,
          awarded_on: '2026-09-01',
        },
      ] as never);

      const csv = await service.exportRiseCsv();
      const lines = csv.trim().split('\n');

      expect(lines[0]).toBe(
        'first_name,last_name,dob,bg_membership_number,scheme,level,award_date',
      );
      expect(lines[1]).toBe(
        'Ava,Nolan,2016-04-02,1234567,British Gymnastics Rise,Explore 3,2026-09-01',
      );
    });

    it('leaves out badges that are only assessed unless asked for them', async () => {
      awardsRepository.findAllSchemes.mockResolvedValue([
        { scheme_id: SCHEME_ID, name: 'British Gymnastics Rise' },
      ] as never);
      awardsRepository.findAllLevels.mockResolvedValue([makeLevel()] as never);
      awardsRepository.findProgressByMembers.mockResolvedValue([
        {
          member_id: 'member-1',
          level_id: LEVEL_ID,
          status: AwardProgressStatus.ASSESSED,
          assessed_on: '2026-09-01',
        },
      ] as never);

      expect((await service.exportRiseCsv()).trim().split('\n')).toHaveLength(1);
      expect(
        (await service.exportRiseCsv({ includeAssessed: true })).trim().split('\n'),
      ).toHaveLength(2);
    });
  });

  describe('Rise CSV import', () => {
    const csv = [
      'first_name,last_name,dob,bg_membership_number,scheme,level,award_date',
      'Ava,Nolan,02/04/2016,1234567,British Gymnastics Rise,Explore 3,01/09/2026',
    ].join('\n');

    beforeEach(() => {
      awardsRepository.findAllSchemes.mockResolvedValue([
        { scheme_id: SCHEME_ID, name: 'British Gymnastics Rise' },
      ] as never);
      awardsRepository.findAllLevels.mockResolvedValue([makeLevel()] as never);
    });

    it('matches a row on the BG membership number', async () => {
      const preview = await service.previewRiseImport({ csv });

      expect(preview.matched).toBe(1);
      expect(preview.rows[0].matched_on).toBe('registration_number');
      expect(preview.rows[0].member_id).toBe('member-1');
      expect(preview.rows[0].level_id).toBe(LEVEL_ID);
    });

    it('falls back to name and date of birth when there is no membership number', async () => {
      const withoutNumber = csv.replace(',1234567,', ',,');

      const preview = await service.previewRiseImport({ csv: withoutNumber });

      expect(preview.rows[0].matched_on).toBe('name_and_dob');
      expect(preview.rows[0].member_id).toBe('member-1');
    });

    it('reports a row it cannot match rather than guessing', async () => {
      membersRepository.findAll.mockResolvedValue([]);

      const preview = await service.previewRiseImport({ csv });

      expect(preview.matched).toBe(0);
      expect(preview.unmatched).toBe(1);
      expect(preview.rows[0].errors[0]).toContain('gymnast');
    });

    it('treats an ambiguous membership number as no match', async () => {
      membersRepository.findAll.mockResolvedValue([
        makeMember({ member_id: 'member-1' }),
        makeMember({ member_id: 'member-2', first_name: 'Beth' }),
      ]);

      const preview = await service.previewRiseImport({ csv });

      expect(preview.rows[0].member_id).toBeNull();
    });

    it('imports a matched row as an awarded badge without billing by default', async () => {
      const result = await service.importRiseCsv({ csv });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.invoices_raised).toBe(0);
      expect(billing.record).not.toHaveBeenCalled();
      expect(awardsRepository.upsertProgress).toHaveBeenCalledWith(
        'member-1',
        LEVEL_ID,
        expect.objectContaining({
          status: AwardProgressStatus.AWARDED,
          awarded_on: '2026-09-01',
        }),
      );
    });

    it('requires a separate fee preview rather than charging from a CSV', async () => {
      await expect(service.importRiseCsv({ csv, bill_fees: true })).rejects.toThrow('review fees');
      expect(awardsRepository.upsertProgress).not.toHaveBeenCalled();
    });

    it('skips and reports a row it could not resolve', async () => {
      membersRepository.findAll.mockResolvedValue([]);

      const result = await service.importRiseCsv({ csv });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.warnings[0]).toContain('Row 2');
      expect(awardsRepository.upsertProgress).not.toHaveBeenCalled();
    });

    it('reports the line a club sees in its own spreadsheet, blank lines included', async () => {
      membersRepository.findAll.mockResolvedValue([]);
      // A blank leading line and a blank line between the rows, which a club's
      // export routinely has. The unmatched row is on line 5 of the file.
      const padded = [
        '',
        'first_name,last_name,dob,bg_membership_number,scheme,level,award_date',
        'Ava,Nolan,02/04/2016,1234567,British Gymnastics Rise,Explore 3,01/09/2026',
        '',
        'Beth,Doyle,05/05/2015,7654321,British Gymnastics Rise,Explore 3,01/09/2026',
      ].join('\n');

      const preview = await service.previewRiseImport({ csv: padded });

      expect(preview.rows.map((row) => row.row_number)).toEqual([3, 5]);
      expect(preview.missing_headers).toEqual([]);

      const result = await service.importRiseCsv({ csv: padded });
      expect(result.warnings.some((warning) => warning.startsWith('Row 5:'))).toBe(true);
    });

    it('keeps going and reports the line when one row fails to write', async () => {
      membersRepository.findAll.mockResolvedValue([
        makeMember({ member_id: 'member-1' }),
        makeMember({ member_id: 'member-2', first_name: 'Beth', registration_number: '7654321' }),
      ]);
      awardsRepository.upsertProgress
        .mockRejectedValueOnce(new Error('violates foreign key constraint'))
        .mockResolvedValueOnce({ progress_id: 'progress-2' } as never);

      const twoRows = [
        csv,
        'Beth,Nolan,02/04/2016,7654321,British Gymnastics Rise,Explore 3,01/09/2026',
      ].join('\n');

      const result = await service.importRiseCsv({ csv: twoRows });

      // The second row still lands, and the failure is reported against the
      // line the club can go and look at.
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.warnings.some((warning) => warning.startsWith('Row 2:'))).toBe(true);
    });

    it('keeps the parser line number out of the preview payload', async () => {
      const preview = await service.previewRiseImport({ csv });

      expect(preview.rows[0]).not.toHaveProperty('lineNumber');
    });
  });

  describe('getMemberProgress', () => {
    it('reads through the tenant-scoped repository', async () => {
      await service.getMemberProgress('member-1');

      expect(awardsRepository.findProgressByMember).toHaveBeenCalledWith('member-1');
    });
  });
});
