import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { FeeStructuresRepository } from '../fee-structures/fee-structures.repository';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../../email/email.service';
import { FamiliesRepository } from '../../families/families.repository';
import { MembersRepository } from '../../members/members.repository';
import { AppliesToType, FeeFrequency } from '../fee-structures/entities/fee-structure.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let _invoicesRepository: InvoicesRepository;

  const CLUB_ID = '999e0000-e89b-12d3-a456-426614174099';

  const mockFamily = {
    family_id: '334e5678-e89b-12d3-a456-426614174002',
    family_name: 'The Smiths',
    primary_contact_name: 'Jane Smith',
    primary_contact_email: 'jane.smith@example.com',
  };

  const mockInvoice: Partial<Invoice> = {
    invoice_id: '123e4567-e89b-12d3-a456-426614174000',
    family_id: mockFamily.family_id,
    invoice_number: 'INV-2026-0001',
    subtotal: 50.0,
    tax_amount: 0,
    total_amount: 50.0,
    currency: 'GBP',
    due_date: new Date('2026-03-01'),
    issued_date: new Date('2026-02-15'),
    status: InvoiceStatus.PENDING,
    notes: null,
    items: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockInvoicesRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByFamily: jest.fn(),
    findByStatus: jest.fn(),
    findOverdue: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createInvoiceItem: jest.fn(),
    updateTotals: jest.fn(),
    updateStatus: jest.fn(),
    getTotalRevenue: jest.fn(),
    getTotalOutstanding: jest.fn(),
    countByStatus: jest.fn(),
    findByFeeStructureAndPeriod: jest.fn(),
  };

  const mockFeeStructuresRepository = {
    findAll: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMembersRepository = {
    findOne: jest.fn(),
    findBySquadId: jest.fn(),
  };

  const mockPaymentsService = {
    collectDirectDebitPayment: jest.fn(),
  };

  const mockEmailService = {
    sendInvoiceCreated: jest.fn(),
  };

  const mockFamiliesRepository = {
    findOne: jest.fn(),
    findAll: jest.fn(),
  };

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  const mockTenantContext = {
    getClubId: jest.fn().mockReturnValue(CLUB_ID),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: InvoicesRepository, useValue: mockInvoicesRepository },
        { provide: FeeStructuresRepository, useValue: mockFeeStructuresRepository },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: FamiliesRepository, useValue: mockFamiliesRepository },
        { provide: MembersRepository, useValue: mockMembersRepository },
        { provide: ClubsRepository, useValue: mockClubsRepository },
        { provide: TenantContextService, useValue: mockTenantContext },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    _invoicesRepository = module.get<InvoicesRepository>(InvoicesRepository);

    // Default: the active club bills in GBP, mirroring an existing UK club.
    mockClubsRepository.findOne.mockResolvedValue({ id: CLUB_ID, currency: 'GBP' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an invoice and send a creation email', async () => {
      const createDto = {
        family_id: mockFamily.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
        items: [],
      };

      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice });
      mockInvoicesRepository.findOne.mockResolvedValue({ ...mockInvoice });
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      const result = await service.create(createDto as unknown as CreateInvoiceDto);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-2026-0001');
      expect(mockInvoicesRepository.create).toHaveBeenCalled();
    });

    it('should format a GB club email with pound amounts and day/month/year dates', async () => {
      const createDto = {
        family_id: mockFamily.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
        items: [],
      };

      // A GB club (GBP/en-GB/Europe/London) must produce the same strings as
      // the previous hardcoded formatting.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'GB',
        currency: 'GBP',
        locale: 'en-GB',
        timezone: 'Europe/London',
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        items: [{ description: 'Monthly fee', total: 50.0 }],
      });
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(createDto as unknown as CreateInvoiceDto);

      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceDate: '15/02/2026',
          dueDate: '01/03/2026',
          totalAmount: '£50.00',
          items: [{ description: 'Monthly fee', amount: '£50.00' }],
        }),
      );
    });

    it('should format a US club email with dollar amounts and month-first dates', async () => {
      const createDto = {
        family_id: mockFamily.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
        items: [],
      };

      // A US club (USD/en-US/America/New_York) gets $ amounts and month/day/year.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice, currency: 'USD' });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        currency: 'USD',
        items: [{ description: 'Monthly fee', total: 50.0 }],
      });
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(createDto as unknown as CreateInvoiceDto);

      // issued_date and due_date are date-only columns, so the stored calendar
      // dates render as-is (month-first for en-US) and must never shift with
      // the club's timezone.
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceDate: '2/15/2026',
          dueDate: '3/1/2026',
          totalAmount: '$50.00',
          items: [{ description: 'Monthly fee', amount: '$50.00' }],
        }),
      );
    });

    it('should create the invoice in the owning club currency', async () => {
      const createDto = {
        family_id: mockFamily.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
        items: [],
      };

      // Non-GBP club so the currency clearly flows from the club to the invoice.
      mockClubsRepository.findOne.mockResolvedValue({ id: CLUB_ID, currency: 'AUD' });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice, currency: 'AUD' });
      mockInvoicesRepository.findOne.mockResolvedValue({ ...mockInvoice, currency: 'AUD' });
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(createDto as unknown as CreateInvoiceDto);

      // The repository receives the resolved club currency as its third argument.
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        createDto,
        'INV-2026-0001',
        'AUD',
      );
    });

    it('should still create the invoice if email sending fails', async () => {
      const createDto = {
        family_id: mockFamily.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
        items: [],
      };

      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice });
      mockInvoicesRepository.findOne.mockResolvedValue({ ...mockInvoice });
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockRejectedValue(new Error('SMTP failure'));
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      const result = await service.create(createDto as unknown as CreateInvoiceDto);

      expect(result).toBeDefined();
    });

    it('should create invoice items and recalculate totals when items are provided', async () => {
      const createDto = {
        family_id: mockFamily.family_id,
        due_date: new Date('2026-03-01'),
        issued_date: new Date('2026-02-15'),
        items: [{ description: 'Monthly fee', quantity: 1, unit_price: 50.0, total: 50.0 }],
      };

      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        items: [{ description: 'Monthly fee', total: 50.0 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      const result = await service.create(createDto as unknown as CreateInvoiceDto);

      expect(mockInvoicesRepository.createInvoiceItem).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('tax on recalculated totals', () => {
    const baseCreateDto = {
      family_id: mockFamily.family_id,
      due_date: new Date('2026-03-01'),
      issued_date: new Date('2026-02-15'),
      items: [{ description: 'Monthly fee', quantity: 1, unit_price: 100.0, total: 100.0 }],
    };

    it('applies no tax and produces byte-identical totals for a null-rate GB club', async () => {
      // Every existing UK club has tax_rate null: tax_amount stays 0 and the
      // total equals the subtotal, exactly as before.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'GB',
        currency: 'GBP',
        locale: 'en-GB',
        timezone: 'Europe/London',
        tax_rate: null,
        tax_label: null,
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice, club_id: CLUB_ID });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        items: [{ description: 'Monthly fee', total: 100.0 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(baseCreateDto as unknown as CreateInvoiceDto);

      // subtotal 100, tax 0, total 100.
      expect(mockInvoicesRepository.updateTotals).toHaveBeenCalledWith(
        mockInvoice.invoice_id,
        100,
        0,
        100,
      );
      // No tax fields on the email, so the template renders a single Total row.
      const emailArg = mockEmailService.sendInvoiceCreated.mock.calls[0][0];
      expect(emailArg.subtotal).toBeUndefined();
      expect(emailArg.taxLabel).toBeUndefined();
      expect(emailArg.taxAmount).toBeUndefined();
    });

    it('applies an 8.25% US sales tax to a $100 subtotal and shows it on the email', async () => {
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
        tax_rate: '8.25',
        tax_label: 'Sales tax',
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'USD',
      });
      // The invoice re-read after recalculation carries the computed amounts.
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'USD',
        subtotal: 100.0,
        tax_amount: 8.25,
        total_amount: 108.25,
        items: [{ description: 'Monthly fee', total: 100.0 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(baseCreateDto as unknown as CreateInvoiceDto);

      // subtotal 100, tax 8.25, total 108.25.
      expect(mockInvoicesRepository.updateTotals).toHaveBeenCalledWith(
        mockInvoice.invoice_id,
        100,
        8.25,
        108.25,
      );
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: '$100.00',
          taxLabel: 'Sales tax',
          taxAmount: '$8.25',
          totalAmount: '$108.25',
        }),
      );
    });

    it('keeps the exclusive (added-on-top) maths when tax_inclusive is false', async () => {
      // Regression guard: an explicit tax_inclusive false must be exactly the
      // pre-existing behaviour, byte-identical for GB and US clubs alike.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
        tax_rate: '8.25',
        tax_label: 'Sales tax',
        tax_inclusive: false,
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'USD',
      });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'USD',
        items: [{ description: 'Monthly fee', total: 100.0 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(baseCreateDto as unknown as CreateInvoiceDto);

      // subtotal 100, tax 8.25 added on top, total 108.25.
      expect(mockInvoicesRepository.updateTotals).toHaveBeenCalledWith(
        mockInvoice.invoice_id,
        100,
        8.25,
        108.25,
      );
    });

    it('backs GST out of the gross for a tax-inclusive AU club ($55 at 10%)', async () => {
      // Australian convention: prices already include GST. A $55.00 line-item
      // sum is the gross the family pays: $5.00 GST on a $50.00 subtotal.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'AU',
        currency: 'AUD',
        locale: 'en-AU',
        timezone: 'Australia/Sydney',
        tax_rate: '10.00',
        tax_label: 'GST',
        tax_inclusive: true,
        tax_registration_number: '51824753556',
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'AUD',
      });
      // The invoice re-read after recalculation carries the computed amounts.
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'AUD',
        subtotal: 50.0,
        tax_amount: 5.0,
        total_amount: 55.0,
        items: [{ description: 'Monthly fee', total: 55.0 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      const dto = {
        ...baseCreateDto,
        items: [{ description: 'Monthly fee', quantity: 1, unit_price: 55.0, total: 55.0 }],
      };

      await service.create(dto as unknown as CreateInvoiceDto);

      // subtotal 50, tax 5 backed out, total stays at the 55 gross.
      expect(mockInvoicesRepository.updateTotals).toHaveBeenCalledWith(
        mockInvoice.invoice_id,
        50,
        5,
        55,
      );
      // The email is a tax invoice: inclusive breakdown plus the ABN line.
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          subtotal: '$50.00',
          taxLabel: 'GST',
          taxAmount: '$5.00',
          totalAmount: '$55.00',
          taxInclusive: true,
          isTaxInvoice: true,
          taxRegistrationLabel: 'ABN',
          taxRegistrationNumber: '51824753556',
        }),
      );
    });

    it('omits the tax invoice fields when the club has no registration number', async () => {
      // Tax applied but no registration number: the breakdown renders, but the
      // email is NOT a tax invoice, so GB clubs without a VAT number see no
      // change to their emails.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'GB',
        currency: 'GBP',
        locale: 'en-GB',
        timezone: 'Europe/London',
        tax_rate: '20.00',
        tax_label: 'VAT',
        tax_inclusive: false,
        tax_registration_number: null,
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({ ...mockInvoice, club_id: CLUB_ID });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        subtotal: 100.0,
        tax_amount: 20.0,
        total_amount: 120.0,
        items: [{ description: 'Monthly fee', total: 100.0 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      await service.create(baseCreateDto as unknown as CreateInvoiceDto);

      const emailArg = mockEmailService.sendInvoiceCreated.mock.calls[0][0];
      expect(emailArg.isTaxInvoice).toBeUndefined();
      expect(emailArg.taxRegistrationLabel).toBeUndefined();
      expect(emailArg.taxRegistrationNumber).toBeUndefined();
      expect(emailArg.taxLabel).toBe('VAT');
    });

    it('rounds the tax amount to two decimal places (8.25% of 33.33)', async () => {
      // 8.25% of 33.33 = 2.749725, which must round to 2.75.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
        tax_rate: '8.25',
        tax_label: 'Sales tax',
      });
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'USD',
      });
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        club_id: CLUB_ID,
        currency: 'USD',
        items: [{ description: 'Monthly fee', total: 33.33 }],
      });
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);

      const dto = {
        ...baseCreateDto,
        items: [{ description: 'Monthly fee', quantity: 1, unit_price: 33.33, total: 33.33 }],
      };

      await service.create(dto as unknown as CreateInvoiceDto);

      expect(mockInvoicesRepository.updateTotals).toHaveBeenCalledWith(
        mockInvoice.invoice_id,
        33.33,
        2.75,
        36.08,
      );
    });
  });

  describe('invoice generation engine', () => {
    const FEE_ID = '777e0000-e89b-12d3-a456-426614174777';
    const SQUAD_ID = '888e0000-e89b-12d3-a456-426614174888';

    const familyA = {
      family_id: 'aaae0000-e89b-12d3-a456-426614174aaa',
      family_name: 'The Smiths',
      primary_contact_email: 'jane.smith@example.com',
    };
    const familyB = {
      family_id: 'bbbe0000-e89b-12d3-a456-426614174bbb',
      family_name: 'The Joneses',
      primary_contact_email: 'joan.jones@example.com',
    };

    const memberA1 = {
      member_id: 'a1ae0000-e89b-12d3-a456-4266141741a1',
      family_id: familyA.family_id,
      first_name: 'Alice',
      last_name: 'Smith',
      squad_id: SQUAD_ID,
    };
    const memberA2 = {
      member_id: 'a2ae0000-e89b-12d3-a456-4266141741a2',
      family_id: familyA.family_id,
      first_name: 'Ben',
      last_name: 'Smith',
      squad_id: SQUAD_ID,
    };
    const memberB1 = {
      member_id: 'b1be0000-e89b-12d3-a456-4266141741b1',
      family_id: familyB.family_id,
      first_name: 'Cara',
      last_name: 'Jones',
      squad_id: SQUAD_ID,
    };

    const clubFee = {
      fee_structure_id: FEE_ID,
      name: 'Club Membership',
      amount: '30.00',
      frequency: FeeFrequency.MONTHLY,
      applies_to_type: AppliesToType.CLUB,
      applies_to_id: null,
      active: true,
    };

    const currentYear = String(new Date().getFullYear());

    beforeEach(() => {
      // Happy-path plumbing shared by the generation tests. The engine runs
      // every invoice through the real create() path, so the same repository
      // mocks used by the create tests apply here.
      mockInvoicesRepository.count.mockResolvedValue(0);
      mockInvoicesRepository.create.mockImplementation(
        async (dto: { family_id: string }) =>
          ({ ...mockInvoice, family_id: dto.family_id }) as Invoice,
      );
      mockInvoicesRepository.findOne.mockResolvedValue({ ...mockInvoice });
      mockInvoicesRepository.findByFeeStructureAndPeriod.mockResolvedValue([]);
      mockInvoicesRepository.createInvoiceItem.mockResolvedValue(undefined);
      mockInvoicesRepository.updateTotals.mockResolvedValue(undefined);
      mockFamiliesRepository.findOne.mockImplementation(async (id: string) =>
        id === familyA.family_id ? familyA : id === familyB.family_id ? familyB : null,
      );
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockPaymentsService.collectDirectDebitPayment.mockResolvedValue(null);
    });

    it('creates one invoice per family for a club-wide fee, one line item per family', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({ ...clubFee });
      mockFamiliesRepository.findAll.mockResolvedValue([familyA, familyB]);

      const result = await service.generateInvoicesForFeeStructure(FEE_ID);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.invoices).toHaveLength(2);
      expect(mockInvoicesRepository.create).toHaveBeenCalledTimes(2);
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: familyA.family_id,
          fee_structure_id: FEE_ID,
          billing_period: expect.stringMatching(/^\d{4}-\d{2}$/),
          items: [
            expect.objectContaining({
              description: 'Club Membership',
              unit_price: 30,
              quantity: 1,
              fee_structure_id: FEE_ID,
            }),
          ],
        }),
        expect.any(String),
        'GBP',
      );
    });

    it('invoices each family with a member in the squad, one line item per member', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({
        ...clubFee,
        name: 'Squad Fee',
        applies_to_type: AppliesToType.SQUAD,
        applies_to_id: SQUAD_ID,
      });
      mockMembersRepository.findBySquadId.mockResolvedValue([memberA1, memberA2, memberB1]);

      const result = await service.generateInvoicesForFeeStructure(FEE_ID);

      expect(result.created).toBe(2);
      expect(mockMembersRepository.findBySquadId).toHaveBeenCalledWith(SQUAD_ID);
      // Family A has two members in the squad, so its invoice has two items.
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: familyA.family_id,
          items: [
            expect.objectContaining({ description: 'Squad Fee - Alice Smith', unit_price: 30 }),
            expect.objectContaining({ description: 'Squad Fee - Ben Smith', unit_price: 30 }),
          ],
        }),
        expect.any(String),
        'GBP',
      );
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: familyB.family_id,
          items: [expect.objectContaining({ description: 'Squad Fee - Cara Jones' })],
        }),
        expect.any(String),
        'GBP',
      );
    });

    it('invoices only the member family for a per-member fee', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({
        ...clubFee,
        name: 'Kit Fee',
        applies_to_type: AppliesToType.MEMBER,
        applies_to_id: memberB1.member_id,
      });
      mockMembersRepository.findOne.mockResolvedValue(memberB1);

      const result = await service.generateInvoicesForFeeStructure(FEE_ID);

      expect(result.created).toBe(1);
      expect(mockInvoicesRepository.create).toHaveBeenCalledTimes(1);
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_id: familyB.family_id,
          items: [expect.objectContaining({ description: 'Kit Fee - Cara Jones' })],
        }),
        expect.any(String),
        'GBP',
      );
    });

    it('skips families already invoiced for the fee structure and period', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({ ...clubFee });
      mockFamiliesRepository.findAll.mockResolvedValue([familyA, familyB]);
      // Family A already has a pending invoice for this fee and period.
      mockInvoicesRepository.findByFeeStructureAndPeriod.mockResolvedValue([
        { ...mockInvoice, family_id: familyA.family_id, status: InvoiceStatus.PENDING },
      ]);

      const result = await service.generateInvoicesForFeeStructure(FEE_ID);

      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockInvoicesRepository.create).toHaveBeenCalledTimes(1);
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ family_id: familyB.family_id }),
        expect.any(String),
        'GBP',
      );
    });

    it('uses the caller-supplied period label for a term fee', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({
        ...clubFee,
        frequency: FeeFrequency.TERM,
      });
      mockFamiliesRepository.findAll.mockResolvedValue([familyA]);

      await service.generateInvoicesForFeeStructure(FEE_ID, 'Term 1 2027');

      expect(mockInvoicesRepository.findByFeeStructureAndPeriod).toHaveBeenCalledWith(
        FEE_ID,
        'Term 1 2027',
      );
      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ billing_period: 'Term 1 2027' }),
        expect.any(String),
        'GBP',
      );
    });

    it('defaults a term fee without a label to the current year', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({
        ...clubFee,
        frequency: FeeFrequency.TERM,
      });
      mockFamiliesRepository.findAll.mockResolvedValue([familyA]);

      await service.generateInvoicesForFeeStructure(FEE_ID);

      expect(mockInvoicesRepository.findByFeeStructureAndPeriod).toHaveBeenCalledWith(
        FEE_ID,
        currentYear,
      );
    });

    it('flows the club currency and tax through the standard create path', async () => {
      // An AU club with inclusive GST: generated invoices must be created in
      // AUD and have GST backed out of the gross, exactly like manual ones.
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'AU',
        currency: 'AUD',
        locale: 'en-AU',
        timezone: 'Australia/Sydney',
        tax_rate: '10.00',
        tax_label: 'GST',
        tax_inclusive: true,
      });
      mockFeeStructuresRepository.findOne.mockResolvedValue({ ...clubFee, amount: '55.00' });
      mockFamiliesRepository.findAll.mockResolvedValue([familyA]);
      mockInvoicesRepository.findOne.mockResolvedValue({
        ...mockInvoice,
        currency: 'AUD',
        items: [{ description: 'Club Membership', total: 55.0 }],
      });

      await service.generateInvoicesForFeeStructure(FEE_ID);

      expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ family_id: familyA.family_id }),
        expect.any(String),
        'AUD',
      );
      // $55.00 gross at 10% inclusive GST: $50.00 subtotal, $5.00 tax.
      expect(mockInvoicesRepository.updateTotals).toHaveBeenCalledWith(
        mockInvoice.invoice_id,
        50,
        5,
        55,
      );
    });

    it('throws NotFoundException for an unknown fee structure', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue(null);

      await expect(service.generateInvoicesForFeeStructure(FEE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for an inactive fee structure', async () => {
      mockFeeStructuresRepository.findOne.mockResolvedValue({ ...clubFee, active: false });

      await expect(service.generateInvoicesForFeeStructure(FEE_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    describe('generateMonthlyInvoices', () => {
      it('runs every active monthly fee structure through the engine', async () => {
        const annualFee = {
          ...clubFee,
          fee_structure_id: '999e0000-e89b-12d3-a456-426614174111',
          frequency: FeeFrequency.ANNUAL,
        };
        const inactiveFee = {
          ...clubFee,
          fee_structure_id: '999e0000-e89b-12d3-a456-426614174222',
          active: false,
        };
        mockFeeStructuresRepository.findAll.mockResolvedValue([clubFee, annualFee, inactiveFee]);
        mockFamiliesRepository.findAll.mockResolvedValue([familyA, familyB]);

        const result = await service.generateMonthlyInvoices();

        // Only the active monthly fee generates: two families, two invoices.
        expect(result).toHaveLength(2);
        expect(mockInvoicesRepository.create).toHaveBeenCalledTimes(2);
        expect(mockInvoicesRepository.findByFeeStructureAndPeriod).toHaveBeenCalledWith(
          FEE_ID,
          expect.stringMatching(/^\d{4}-\d{2}$/),
        );
      });

      it('is idempotent: a second run in the same month creates nothing', async () => {
        mockFeeStructuresRepository.findAll.mockResolvedValue([clubFee]);
        mockFamiliesRepository.findAll.mockResolvedValue([familyA, familyB]);
        mockInvoicesRepository.findByFeeStructureAndPeriod.mockResolvedValue([
          { ...mockInvoice, family_id: familyA.family_id },
          { ...mockInvoice, family_id: familyB.family_id },
        ]);

        const result = await service.generateMonthlyInvoices();

        expect(result).toHaveLength(0);
        expect(mockInvoicesRepository.create).not.toHaveBeenCalled();
      });

      it('filters to fee structures for the given squad', async () => {
        const squadFee = {
          ...clubFee,
          fee_structure_id: '999e0000-e89b-12d3-a456-426614174333',
          name: 'Squad Fee',
          applies_to_type: AppliesToType.SQUAD,
          applies_to_id: SQUAD_ID,
        };
        mockFeeStructuresRepository.findAll.mockResolvedValue([clubFee, squadFee]);
        mockMembersRepository.findBySquadId.mockResolvedValue([memberB1]);

        const result = await service.generateMonthlyInvoices(SQUAD_ID);

        // Only the squad-scoped fee runs; the club-wide fee is filtered out.
        expect(result).toHaveLength(1);
        expect(mockFamiliesRepository.findAll).not.toHaveBeenCalled();
        expect(mockInvoicesRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ family_id: familyB.family_id }),
          expect.any(String),
          'GBP',
        );
      });
    });
  });

  describe('findAll', () => {
    it('should return all invoices', async () => {
      mockInvoicesRepository.findAll.mockResolvedValue([mockInvoice]);

      const result = await service.findAll();

      expect(result).toEqual([mockInvoice]);
    });
  });

  describe('findByFamily', () => {
    it('should return invoices for a specific family', async () => {
      mockInvoicesRepository.findByFamily.mockResolvedValue([mockInvoice]);

      const result = await service.findByFamily(mockFamily.family_id);

      expect(result).toEqual([mockInvoice]);
      expect(mockInvoicesRepository.findByFamily).toHaveBeenCalledWith(mockFamily.family_id);
    });
  });

  describe('findByStatus', () => {
    it('should return invoices with a specific status', async () => {
      mockInvoicesRepository.findByStatus.mockResolvedValue([mockInvoice]);

      const result = await service.findByStatus(InvoiceStatus.PENDING);

      expect(result).toEqual([mockInvoice]);
      expect(mockInvoicesRepository.findByStatus).toHaveBeenCalledWith(InvoiceStatus.PENDING);
    });
  });

  describe('findOverdue', () => {
    it('should return overdue invoices', async () => {
      const overdueInvoice = { ...mockInvoice, status: InvoiceStatus.OVERDUE };
      mockInvoicesRepository.findOverdue.mockResolvedValue([overdueInvoice]);

      const result = await service.findOverdue();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(InvoiceStatus.OVERDUE);
    });
  });

  describe('findOne', () => {
    it('should return a single invoice', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);

      const result = await service.findOne(mockInvoice.invoice_id as string);

      expect(result).toEqual(mockInvoice);
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      const updateDto = { notes: 'Updated note' };
      const updatedInvoice = { ...mockInvoice, notes: 'Updated note' };

      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockInvoicesRepository.update.mockResolvedValue(updatedInvoice);

      const result = await service.update(
        mockInvoice.invoice_id as string,
        updateDto as unknown as UpdateInvoiceDto,
      );

      expect(result.notes).toBe('Updated note');
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { notes: 'test' } as UpdateInvoiceDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove an invoice', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockInvoicesRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockInvoice.invoice_id as string);

      expect(mockInvoicesRepository.remove).toHaveBeenCalledWith(mockInvoice.invoice_id);
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendReminder', () => {
    it('should send a reminder and return a success message', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      const result = await service.sendReminder(mockInvoice.invoice_id as string);

      expect(result.message).toBe('Payment reminder sent successfully');
    });

    it('should format the GB reminder email with pound amounts and day/month/year dates', async () => {
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'GB',
        currency: 'GBP',
        locale: 'en-GB',
        timezone: 'Europe/London',
      });
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.sendReminder(mockInvoice.invoice_id as string);

      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceDate: '15/02/2026',
          dueDate: '01/03/2026',
          totalAmount: '£50.00',
        }),
      );
    });

    it('should format the US reminder email with dollar amounts and month-first dates', async () => {
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
      });
      mockInvoicesRepository.findOne.mockResolvedValue({ ...mockInvoice, currency: 'USD' });
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.sendReminder(mockInvoice.invoice_id as string);

      // Date-only columns render as the stored calendar date and never shift.
      expect(mockEmailService.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceDate: '2/15/2026',
          dueDate: '3/1/2026',
          totalAmount: '$50.00',
        }),
      );
    });

    it('should throw BadRequestException for a paid invoice', async () => {
      const paidInvoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      mockInvoicesRepository.findOne.mockResolvedValue(paidInvoice);

      await expect(service.sendReminder(paidInvoice.invoice_id as string)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for a cancelled invoice', async () => {
      const cancelledInvoice = { ...mockInvoice, status: InvoiceStatus.CANCELLED };
      mockInvoicesRepository.findOne.mockResolvedValue(cancelledInvoice);

      await expect(service.sendReminder(cancelledInvoice.invoice_id as string)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should mark a draft invoice as pending when sending a reminder', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT };
      mockInvoicesRepository.findOne.mockResolvedValue(draftInvoice);
      mockFamiliesRepository.findOne.mockResolvedValue(mockFamily);
      mockEmailService.sendInvoiceCreated.mockResolvedValue(undefined);
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.sendReminder(draftInvoice.invoice_id as string);

      expect(mockInvoicesRepository.updateStatus).toHaveBeenCalledWith(
        draftInvoice.invoice_id,
        InvoiceStatus.PENDING,
      );
    });
  });

  describe('updateOverdueInvoices', () => {
    it('should mark overdue invoices with OVERDUE status', async () => {
      const pastDueInvoice = { ...mockInvoice, status: InvoiceStatus.PENDING };
      mockInvoicesRepository.findOverdue.mockResolvedValue([pastDueInvoice]);
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.updateOverdueInvoices();

      expect(mockInvoicesRepository.updateStatus).toHaveBeenCalledWith(
        pastDueInvoice.invoice_id,
        InvoiceStatus.OVERDUE,
      );
    });

    it('should not call updateStatus if no invoices are overdue', async () => {
      mockInvoicesRepository.findOverdue.mockResolvedValue([]);

      await service.updateOverdueInvoices();

      expect(mockInvoicesRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
