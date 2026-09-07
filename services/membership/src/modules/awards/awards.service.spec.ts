import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AssessmentOutcomeResult, AwardProgressStatus } from '@club-manager/shared-types';
import { AwardsService } from './awards.service';
import { AwardsRepository } from './awards.repository';
import { InvoicesService } from '../finance/invoices/invoices.service';
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
  let invoicesService: jest.Mocked<InvoicesService>;
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

    const invoicesServiceMock = {
      create: jest.fn().mockResolvedValue({ invoice_id: 'invoice-1' }),
    };

    const membersRepositoryMock = {
      findOne: jest.fn().mockResolvedValue(makeMember()),
      findAll: jest.fn().mockResolvedValue([makeMember()]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwardsService,
        { provide: AwardsRepository, useValue: awardsRepositoryMock },
        { provide: InvoicesService, useValue: invoicesServiceMock },
        { provide: MembersRepository, useValue: membersRepositoryMock },
      ],
    }).compile();

    service = module.get(AwardsService);
    awardsRepository = module.get(AwardsRepository);
    invoicesService = module.get(InvoicesService);
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
    beforeEach(() => {
      awardsRepository.findOneLevel.mockResolvedValue(makeLevel());
    });

    it('bills an awarded badge through InvoicesService.create, not the repository', async () => {
      const result = await service.recordAssessment(
        {
          level_id: LEVEL_ID,
          assessed_at: '2026-09-01',
          outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
        },
        'user-1',
      );

      expect(invoicesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: FAMILY_ID,
          issued_date: '2026-09-01',
          due_date: '2026-09-15',
          items: [
            expect.objectContaining({
              description: 'British Gymnastics Rise Explore 3 badge',
              unit_price: 4.5,
              quantity: 1,
            }),
          ],
        }),
      );
      expect(result.awarded).toBe(1);
      expect(result.invoices_raised).toBe(1);
      expect(result.warnings).toEqual([]);
      expect(awardsRepository.updateOutcomeInvoice).toHaveBeenCalledWith('outcome-1', 'invoice-1');
    });

    it('adds a certificate item when the level carries a certificate fee', async () => {
      awardsRepository.findOneLevel.mockResolvedValue(makeLevel({ certificate_fee: 2 }));

      await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      });

      const dto = invoicesService.create.mock.calls[0][0];
      expect(dto.items).toHaveLength(2);
      expect(dto.items?.[1].description).toBe('British Gymnastics Rise Explore 3 certificate');
    });

    it('coerces the string a decimal column returns into a numeric unit price', async () => {
      awardsRepository.findOneLevel.mockResolvedValue(
        makeLevel({ badge_fee: '4.50' as unknown as number }),
      );

      await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      });

      expect(invoicesService.create.mock.calls[0][0].items?.[0].unit_price).toBe(4.5);
    });

    it('keeps the award and warns when the gymnast has no family to bill', async () => {
      membersRepository.findOne.mockResolvedValue(makeMember({ family_id: null }));

      const result = await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      });

      expect(invoicesService.create).not.toHaveBeenCalled();
      expect(result.awarded).toBe(1);
      expect(result.invoices_raised).toBe(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Ava Nolan');
      expect(result.warnings[0]).toContain('no family on record');
      // The award still stands: progress is recorded as awarded.
      expect(awardsRepository.upsertProgress).toHaveBeenCalledWith(
        'member-1',
        LEVEL_ID,
        expect.objectContaining({ status: AwardProgressStatus.AWARDED }),
      );
    });

    it('keeps the award and warns when raising the invoice fails', async () => {
      invoicesService.create.mockRejectedValue(new Error('payment provider unavailable'));

      const result = await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      });

      expect(result.awarded).toBe(1);
      expect(result.invoices_raised).toBe(0);
      expect(result.warnings[0]).toContain('payment provider unavailable');
      expect(awardsRepository.upsertProgress).toHaveBeenCalledWith(
        'member-1',
        LEVEL_ID,
        expect.objectContaining({ status: AwardProgressStatus.AWARDED }),
      );
    });

    it('does not bill an unpriced level', async () => {
      awardsRepository.findOneLevel.mockResolvedValue(
        makeLevel({ badge_fee: null, certificate_fee: null }),
      );

      const result = await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      });

      expect(invoicesService.create).not.toHaveBeenCalled();
      expect(result.warnings).toEqual([]);
    });

    it('does not bill when the coach turns billing off', async () => {
      await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        bill_fees: false,
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
      });

      expect(invoicesService.create).not.toHaveBeenCalled();
    });

    it('does not bill an outcome that did not award the badge', async () => {
      const result = await service.recordAssessment({
        level_id: LEVEL_ID,
        assessed_at: '2026-09-01',
        outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.NOT_YET }],
      });

      expect(invoicesService.create).not.toHaveBeenCalled();
      expect(result.awarded).toBe(0);
      expect(awardsRepository.upsertProgress).toHaveBeenCalledWith(
        'member-1',
        LEVEL_ID,
        expect.objectContaining({ status: AwardProgressStatus.ASSESSED, awarded_on: null }),
      );
    });

    it('rejects a level the club cannot see before writing anything', async () => {
      awardsRepository.findOneLevel.mockResolvedValue(null);

      await expect(
        service.recordAssessment({
          level_id: 'someone-elses-level',
          assessed_at: '2026-09-01',
          outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(awardsRepository.createEvent).not.toHaveBeenCalled();
    });

    it('rejects a member the club cannot see before writing anything', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.recordAssessment({
          level_id: LEVEL_ID,
          assessed_at: '2026-09-01',
          outcomes: [
            { member_id: 'someone-elses-member', outcome: AssessmentOutcomeResult.AWARDED },
          ],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(awardsRepository.createEvent).not.toHaveBeenCalled();
    });

    it('rejects a duplicated gymnast in one assessment', async () => {
      await expect(
        service.recordAssessment({
          level_id: LEVEL_ID,
          assessed_at: '2026-09-01',
          outcomes: [
            { member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED },
            { member_id: 'member-1', outcome: AssessmentOutcomeResult.NOT_YET },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(awardsRepository.createEvent).not.toHaveBeenCalled();
    });

    it('records the assessing coach on the event', async () => {
      await service.recordAssessment(
        {
          level_id: LEVEL_ID,
          assessed_at: '2026-09-01',
          outcomes: [{ member_id: 'member-1', outcome: AssessmentOutcomeResult.AWARDED }],
        },
        'coach-9',
      );

      expect(awardsRepository.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ assessed_by_user_id: 'coach-9' }),
      );
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
      expect(invoicesService.create).not.toHaveBeenCalled();
      expect(awardsRepository.upsertProgress).toHaveBeenCalledWith(
        'member-1',
        LEVEL_ID,
        expect.objectContaining({
          status: AwardProgressStatus.AWARDED,
          awarded_on: '2026-09-01',
        }),
      );
    });

    it('bills on import only when asked, and never twice for the same badge', async () => {
      awardsRepository.findOneLevel.mockResolvedValue(makeLevel());
      awardsRepository.findOneProgress.mockResolvedValue({
        invoice_id: 'invoice-earlier',
      } as never);

      const result = await service.importRiseCsv({ csv, bill_fees: true });

      expect(invoicesService.create).not.toHaveBeenCalled();
      expect(result.invoices_raised).toBe(0);
      expect(awardsRepository.upsertProgress).toHaveBeenCalledWith(
        'member-1',
        LEVEL_ID,
        expect.objectContaining({ invoice_id: 'invoice-earlier' }),
      );
    });

    it('skips and reports a row it could not resolve', async () => {
      membersRepository.findAll.mockResolvedValue([]);

      const result = await service.importRiseCsv({ csv });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.warnings[0]).toContain('Row 2');
      expect(awardsRepository.upsertProgress).not.toHaveBeenCalled();
    });
  });

  describe('getMemberProgress', () => {
    it('reads through the tenant-scoped repository', async () => {
      await service.getMemberProgress('member-1');

      expect(awardsRepository.findProgressByMember).toHaveBeenCalledWith('member-1');
    });
  });
});
