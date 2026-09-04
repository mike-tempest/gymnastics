import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import { ClsService } from 'nestjs-cls';
import { ParentService } from './parent.service';
import { Swimmer } from '../swimmers/entities/swimmer.entity';
import { Session } from '../sessions/entities/session.entity';
import { Invoice } from '../finance/invoices/entities/invoice.entity';
import { Attendance } from '../attendance/entities/attendance.entity';
import { Family } from '../families/entities/family.entity';
import { Payment } from '../finance/payments/entities/payment.entity';
import {
  DirectDebitMandate,
  DirectDebitMandateStatus,
} from '../finance/mandates/entities/direct-debit-mandate.entity';
import { GoCardlessService } from '../gocardless/gocardless.service';
import { ClubsRepository } from '../clubs/clubs.repository';
import { CompetitionResult } from '../competitions/entities/competition-result.entity';
import { PersonalBestsService } from '../competitions/personal-bests.service';
import { CLS_CLUB_ID_KEY, TenantContextService } from '../../common/tenancy/tenant-context.service';
import { TenantScopedHelper } from '../../common/tenancy/tenant-scoped.helper';

/** Minimal in-memory fake of ClsService, matching tenant-scoped.helper.spec.ts. */
class FakeClsService {
  private store = new Map<string, unknown>();

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }
}

describe('ParentService', () => {
  let service: ParentService;
  let cls: FakeClsService;

  const clubId = 'club-uuid-1';
  const familyId = 'family-uuid-1';
  const childId = 'swimmer-uuid-1';
  const invoiceId = 'invoice-uuid-1';

  const mockFamily = {
    family_id: familyId,
    family_name: 'Smith',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockSwimmer = {
    swimmer_id: childId,
    first_name: 'Alice',
    last_name: 'Smith',
    family_id: familyId,
    squad_id: 'squad-uuid-1',
    squad: { squad_id: 'squad-uuid-1', name: 'Dolphins' },
    family: mockFamily,
  };

  const mockInvoice = {
    invoice_id: invoiceId,
    family_id: familyId,
    invoice_number: 'INV-001',
    total_amount: '50.00',
    due_date: new Date(),
    issued_date: new Date(),
    status: 'pending',
    items: [],
  };

  const mockMandate = {
    mandate_id: 'mandate-uuid-1',
    family_id: familyId,
    status: DirectDebitMandateStatus.ACTIVE,
    provider_mandate_id: 'gc-mandate-1',
  };

  // Query builder mock helper
  const createQueryBuilderMock = (result: unknown[] = []) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  });

  const mockFamilyRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockSwimmersRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
  };

  const mockSessionsRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockInvoicesRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockAttendanceRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockPaymentRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMandateRepository = {
    findOne: jest.fn(),
  };

  const mockResultsRepository = {
    find: jest.fn(),
  };

  const mockPersonalBestsService = {
    getForSwimmer: jest.fn(),
    getSeasonBests: jest.fn(),
  };

  const mockGoCardlessService = {
    isConfigured: jest.fn(),
    createPayment: jest.fn(),
  };

  // Only consulted when an invoice has no stamped currency; returning null
  // exercises the final GBP fallback that preserves legacy behaviour.
  const mockClubsRepository = {
    findOne: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    cls = new FakeClsService();
    cls.set(CLS_CLUB_ID_KEY, clubId);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentService,
        TenantScopedHelper,
        TenantContextService,
        { provide: ClsService, useValue: cls },
        { provide: getRepositoryToken(Family), useValue: mockFamilyRepository },
        { provide: getRepositoryToken(Swimmer), useValue: mockSwimmersRepository },
        { provide: getRepositoryToken(Session), useValue: mockSessionsRepository },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoicesRepository },
        { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepository },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        { provide: getRepositoryToken(DirectDebitMandate), useValue: mockMandateRepository },
        { provide: getRepositoryToken(CompetitionResult), useValue: mockResultsRepository },
        { provide: PersonalBestsService, useValue: mockPersonalBestsService },
        { provide: GoCardlessService, useValue: mockGoCardlessService },
        { provide: ClubsRepository, useValue: mockClubsRepository },
      ],
    }).compile();

    service = module.get<ParentService>(ParentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return the family and its swimmers', async () => {
      mockFamilyRepository.findOne.mockResolvedValue(mockFamily);
      mockSwimmersRepository.find.mockResolvedValue([mockSwimmer]);

      const result = await service.getProfile(familyId);

      expect(result).toEqual({ family: mockFamily, swimmers: [mockSwimmer] });
      expect(mockFamilyRepository.findOne).toHaveBeenCalledWith({
        where: { family_id: familyId, club_id: clubId },
      });
      expect(mockSwimmersRepository.find).toHaveBeenCalledWith({
        where: { family_id: familyId, club_id: clubId },
        relations: ['squad'],
      });
    });

    it('should throw NotFoundException when the family does not exist', async () => {
      mockFamilyRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile(familyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard data with children count, sessions, invoices and total', async () => {
      mockSwimmersRepository.count.mockResolvedValue(2);

      const qb = createQueryBuilderMock([]);
      mockSessionsRepository.createQueryBuilder.mockReturnValue(qb);

      mockInvoicesRepository.find.mockResolvedValue([
        { ...mockInvoice, total_amount: '30.00' },
        { ...mockInvoice, invoice_id: 'inv-2', total_amount: '20.00' },
      ]);

      const result = await service.getDashboard(familyId);

      expect(result.childrenCount).toBe(2);
      expect(result.upcomingSessions).toEqual([]);
      expect(result.outstandingInvoices).toHaveLength(2);
      expect(result.totalOutstanding).toBe(50);
    });
  });

  describe('getChildren', () => {
    it('should return all children for a family', async () => {
      mockSwimmersRepository.find.mockResolvedValue([mockSwimmer]);

      const result = await service.getChildren(familyId);

      expect(result).toEqual([mockSwimmer]);
      expect(mockSwimmersRepository.find).toHaveBeenCalledWith({
        where: { family_id: familyId, club_id: clubId },
        relations: ['squad', 'family'],
      });
    });

    it('should return children that have no squad assigned', async () => {
      const squadlessSwimmer = { ...mockSwimmer, squad_id: null, squad: null };
      mockSwimmersRepository.find.mockResolvedValue([squadlessSwimmer]);

      const result = await service.getChildren(familyId);

      expect(result).toEqual([squadlessSwimmer]);
    });

    it('requests only relations that exist on the Swimmer entity', () => {
      // Regression: relations: ['squad'] used to reference a relation the
      // entity did not declare, making TypeORM throw for every family.
      const declaredRelations = getMetadataArgsStorage()
        .relations.filter((relation) => relation.target === Swimmer)
        .map((relation) => relation.propertyName);

      expect(declaredRelations).toEqual(expect.arrayContaining(['squad', 'family']));
    });
  });

  describe('getChild', () => {
    it('should return a single child belonging to the family', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(mockSwimmer);

      const result = await service.getChild(familyId, childId);

      expect(result).toEqual(mockSwimmer);
      expect(mockSwimmersRepository.findOne).toHaveBeenCalledWith({
        where: { swimmer_id: childId, family_id: familyId, club_id: clubId },
        relations: ['squad', 'family'],
      });
    });

    it('should throw NotFoundException when child is not found', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(null);

      await expect(service.getChild(familyId, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChildAttendance', () => {
    it('should throw NotFoundException when child does not belong to family', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(null);

      await expect(service.getChildAttendance(familyId, childId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return attendance records without date filters', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(mockSwimmer);
      const qb = createQueryBuilderMock([{ attendance_id: 'att-1' }]);
      mockAttendanceRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getChildAttendance(familyId, childId);

      expect(result).toEqual([{ attendance_id: 'att-1' }]);
      // Two calls: leftJoinAndSelect for session and squad
      expect(qb.leftJoinAndSelect).toHaveBeenCalledTimes(2);
      // The query builder is pre-scoped to the active club via .where(...).
      expect(qb.where).toHaveBeenCalledWith('attendance.club_id = :clubId', {
        clubId,
      });
      // The swimmer_id filter is appended via andWhere on the scoped builder.
      expect(qb.andWhere).toHaveBeenCalledWith('attendance.swimmer_id = :swimmerId', {
        swimmerId: childId,
      });
      // Only the swimmer_id andWhere; no date-filter andWhere calls.
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
    });

    it('should apply date filters when from and to are provided', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(mockSwimmer);
      const qb = createQueryBuilderMock([]);
      mockAttendanceRepository.createQueryBuilder.mockReturnValue(qb);

      await service.getChildAttendance(familyId, childId, '2025-01-01', '2025-06-30');

      // swimmer_id + from + to = three andWhere calls on the club-scoped builder.
      expect(qb.andWhere).toHaveBeenCalledTimes(3);
      expect(qb.andWhere).toHaveBeenCalledWith('session.session_date >= :from', {
        from: new Date('2025-01-01'),
      });
      expect(qb.andWhere).toHaveBeenCalledWith('session.session_date <= :to', {
        to: new Date('2025-06-30'),
      });
    });
  });

  describe('getChildSchedule', () => {
    it('should throw NotFoundException when child does not belong to family', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(null);

      await expect(service.getChildSchedule(familyId, childId)).rejects.toThrow(NotFoundException);
    });

    it('should return an empty array when the child has no squad', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue({ ...mockSwimmer, squad_id: null });

      const result = await service.getChildSchedule(familyId, childId);

      expect(result).toEqual([]);
      expect(mockSessionsRepository.find).not.toHaveBeenCalled();
    });

    it('should return upcoming sessions for the child squad', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(mockSwimmer);
      const mockSessions = [{ session_id: 's-1', squad_id: 'squad-uuid-1' }];
      mockSessionsRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getChildSchedule(familyId, childId, 14);

      expect(result).toEqual(mockSessions);
      expect(mockSessionsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ squad_id: 'squad-uuid-1' }),
          relations: ['squad'],
          order: { session_date: 'ASC' },
        }),
      );
    });
  });

  describe('getChildResults', () => {
    it('should throw NotFoundException when child does not belong to family', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(null);

      await expect(service.getChildResults(familyId, childId)).rejects.toThrow(NotFoundException);
      expect(mockResultsRepository.find).not.toHaveBeenCalled();
    });

    it('should return the child results with their competitions', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(mockSwimmer);
      const mockResults = [{ result_id: 'result-1', swimmer_id: childId, time: 68.5 }];
      mockResultsRepository.find.mockResolvedValue(mockResults);

      const result = await service.getChildResults(familyId, childId);

      expect(result).toEqual(mockResults);
      expect(mockResultsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ swimmer_id: childId, club_id: clubId }),
          relations: ['competition'],
        }),
      );
    });
  });

  describe('getChildPersonalBests', () => {
    it('should throw NotFoundException when child does not belong to family', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(null);

      await expect(service.getChildPersonalBests(familyId, childId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPersonalBestsService.getForSwimmer).not.toHaveBeenCalled();
    });

    it('should return stored and season bests for the child', async () => {
      mockSwimmersRepository.findOne.mockResolvedValue(mockSwimmer);
      const pbs = [{ pb_id: 'pb-1', swimmer_id: childId, time: 68.5 }];
      mockPersonalBestsService.getForSwimmer.mockResolvedValue(pbs);
      mockPersonalBestsService.getSeasonBests.mockResolvedValue({
        seasonStart: '2025-09-01',
        bests: [],
      });

      const result = await service.getChildPersonalBests(familyId, childId);

      expect(result).toEqual({
        personalBests: pbs,
        seasonBests: [],
        seasonStart: '2025-09-01',
      });
    });
  });

  describe('with the competitions module flagged off (TEM-15)', () => {
    // ParentModule omits the CompetitionResult repository and
    // CompetitionsModule when ENABLE_COMPETITIONS is not 'true', so the
    // service must compile without them and 404 the two results methods.
    let gatedService: ParentService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ParentService,
          TenantScopedHelper,
          TenantContextService,
          { provide: ClsService, useValue: cls },
          { provide: getRepositoryToken(Family), useValue: mockFamilyRepository },
          { provide: getRepositoryToken(Swimmer), useValue: mockSwimmersRepository },
          { provide: getRepositoryToken(Session), useValue: mockSessionsRepository },
          { provide: getRepositoryToken(Invoice), useValue: mockInvoicesRepository },
          { provide: getRepositoryToken(Attendance), useValue: mockAttendanceRepository },
          { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
          { provide: getRepositoryToken(DirectDebitMandate), useValue: mockMandateRepository },
          { provide: GoCardlessService, useValue: mockGoCardlessService },
          { provide: ClubsRepository, useValue: mockClubsRepository },
        ],
      }).compile();

      gatedService = module.get<ParentService>(ParentService);
    });

    it('boots without the competitions providers', () => {
      expect(gatedService).toBeDefined();
    });

    it('404s getChildResults instead of failing at DI time', async () => {
      await expect(gatedService.getChildResults(familyId, childId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockSwimmersRepository.findOne).not.toHaveBeenCalled();
    });

    it('404s getChildPersonalBests instead of failing at DI time', async () => {
      await expect(gatedService.getChildPersonalBests(familyId, childId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPersonalBestsService.getForSwimmer).not.toHaveBeenCalled();
    });
  });

  describe('getInvoices', () => {
    it('should return all invoices for a family', async () => {
      mockInvoicesRepository.find.mockResolvedValue([mockInvoice]);

      const result = await service.getInvoices(familyId);

      expect(result).toEqual([mockInvoice]);
      expect(mockInvoicesRepository.find).toHaveBeenCalledWith({
        where: { family_id: familyId, club_id: clubId },
        relations: ['items'],
        order: { issued_date: 'DESC' },
      });
    });

    it('should filter by status when provided', async () => {
      mockInvoicesRepository.find.mockResolvedValue([]);

      await service.getInvoices(familyId, 'paid');

      expect(mockInvoicesRepository.find).toHaveBeenCalledWith({
        where: { family_id: familyId, status: 'paid', club_id: clubId },
        relations: ['items'],
        order: { issued_date: 'DESC' },
      });
    });
  });

  describe('getInvoice', () => {
    it('should return a single invoice belonging to the family', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);

      const result = await service.getInvoice(familyId, invoiceId);

      expect(result).toEqual(mockInvoice);
    });

    it('should throw NotFoundException when invoice is not found', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(null);

      await expect(service.getInvoice(familyId, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPayments', () => {
    it('should return payments for the family invoices', async () => {
      mockInvoicesRepository.find.mockResolvedValue([
        { invoice_id: 'inv-1' },
        { invoice_id: 'inv-2' },
      ]);
      const mockPayments = [{ payment_id: 'pay-1', invoice_id: 'inv-1' }];
      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.getPayments(familyId);

      expect(result).toEqual(mockPayments);
      expect(mockPaymentRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['invoice'],
          order: { payment_date: 'DESC' },
        }),
      );
    });

    it('should return an empty array when the family has no invoices', async () => {
      mockInvoicesRepository.find.mockResolvedValue([]);

      const result = await service.getPayments(familyId);

      expect(result).toEqual([]);
      expect(mockPaymentRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('getUpcomingSessions', () => {
    it('should return upcoming sessions for family swimmers squads', async () => {
      mockSwimmersRepository.find.mockResolvedValue([{ squad_id: 'sq-1' }, { squad_id: 'sq-2' }]);
      const mockSessions = [{ session_id: 's-1' }];
      mockSessionsRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getUpcomingSessions(familyId);

      expect(result).toEqual(mockSessions);
    });

    it('should return an empty array when no swimmers have squads', async () => {
      mockSwimmersRepository.find.mockResolvedValue([{ squad_id: null }]);

      const result = await service.getUpcomingSessions(familyId);

      expect(result).toEqual([]);
      expect(mockSessionsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('initiatePayment', () => {
    it('should throw NotFoundException when invoice is not found', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(null);

      await expect(service.initiatePayment(familyId, invoiceId)).rejects.toThrow(NotFoundException);
    });

    it('should return no_mandate status when no active mandate exists', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockMandateRepository.findOne.mockResolvedValue(null);

      const result = await service.initiatePayment(familyId, invoiceId);

      expect(result.status).toBe('no_mandate');
      expect(result.paymentId).toBeNull();
    });

    it('should return not_configured status when GoCardless is not configured', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockMandateRepository.findOne.mockResolvedValue(mockMandate);
      mockGoCardlessService.isConfigured.mockReturnValue(false);

      const result = await service.initiatePayment(familyId, invoiceId);

      expect(result.status).toBe('not_configured');
      expect(result.paymentId).toBeNull();
    });

    it('should create a payment successfully via GoCardless', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockMandateRepository.findOne.mockResolvedValue(mockMandate);
      mockGoCardlessService.isConfigured.mockReturnValue(true);
      mockGoCardlessService.createPayment.mockResolvedValue({ id: 'gc-pay-1' });

      const savedPayment = { payment_id: 'pay-new', invoice_id: invoiceId };
      mockPaymentRepository.create.mockReturnValue(savedPayment);
      mockPaymentRepository.save.mockResolvedValue(savedPayment);

      const result = await service.initiatePayment(familyId, invoiceId);

      expect(result.status).toBe('initiated');
      expect(result.paymentId).toBe('pay-new');
      expect(mockGoCardlessService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50,
          currency: 'GBP',
          mandateId: 'gc-mandate-1',
        }),
      );
    });

    it('should charge an AU invoice in its stamped AUD currency', async () => {
      // The invoice's own currency wins: an Australian club's invoices are
      // stamped AUD at creation and must never be collected as GBP.
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        total_amount: '55.00',
        currency: 'AUD',
      });
      mockMandateRepository.findOne.mockResolvedValue(mockMandate);
      mockGoCardlessService.isConfigured.mockReturnValue(true);
      mockGoCardlessService.createPayment.mockResolvedValue({ id: 'gc-pay-2' });

      const savedPayment = { payment_id: 'pay-aud', invoice_id: invoiceId };
      mockPaymentRepository.create.mockReturnValue(savedPayment);
      mockPaymentRepository.save.mockResolvedValue(savedPayment);

      const result = await service.initiatePayment(familyId, invoiceId);

      expect(result.status).toBe('initiated');
      expect(mockGoCardlessService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 55,
          currency: 'AUD',
          mandateId: 'gc-mandate-1',
        }),
      );
      // The payment row records the same currency it was collected in.
      expect(mockPaymentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'AUD' }),
      );
      // The invoice carried a currency, so the club fallback is never needed.
      expect(mockClubsRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fall back to the club currency when the invoice has none stamped', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockMandateRepository.findOne.mockResolvedValue(mockMandate);
      mockGoCardlessService.isConfigured.mockReturnValue(true);
      mockGoCardlessService.createPayment.mockResolvedValue({ id: 'gc-pay-3' });
      mockClubsRepository.findOne.mockResolvedValueOnce({ id: clubId, currency: 'AUD' });

      const savedPayment = { payment_id: 'pay-fallback', invoice_id: invoiceId };
      mockPaymentRepository.create.mockReturnValue(savedPayment);
      mockPaymentRepository.save.mockResolvedValue(savedPayment);

      await service.initiatePayment(familyId, invoiceId);

      expect(mockClubsRepository.findOne).toHaveBeenCalledWith(clubId);
      expect(mockGoCardlessService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'AUD' }),
      );
    });

    it('should return failed status when GoCardless throws an error', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockMandateRepository.findOne.mockResolvedValue(mockMandate);
      mockGoCardlessService.isConfigured.mockReturnValue(true);
      mockGoCardlessService.createPayment.mockRejectedValue(new Error('API error'));

      const result = await service.initiatePayment(familyId, invoiceId);

      expect(result.status).toBe('failed');
      expect(result.paymentId).toBeNull();
    });
  });
});
