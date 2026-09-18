import { BillingBalanceService } from '../adjustments/billing-balance.service';
import { PaymentOperationsService } from '../adjustments/payment-operations.service';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { InvoicesRepository } from '../invoices/invoices.repository';
import { MandatesRepository } from '../mandates/mandates.repository';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import { FamiliesRepository } from '../../families/families.repository';
import { EmailService } from '../../email/email.service';
import { Payment, PaymentStatus, PaymentMethod } from './entities/payment.entity';
import { InvoiceStatus } from '../invoices/entities/invoice.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { ClubsRepository } from '../../clubs/clubs.repository';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let _paymentsRepository: PaymentsRepository;
  let _invoicesRepository: InvoicesRepository;

  const CLUB_ID = '999e0000-e89b-12d3-a456-426614174099';

  const mockInvoice = {
    invoice_id: '123e4567-e89b-12d3-a456-426614174000',
    club_id: CLUB_ID,
    family_id: '334e5678-e89b-12d3-a456-426614174002',
    invoice_number: 'INV-2026-0001',
    total_amount: 50.0,
    currency: 'GBP',
    status: InvoiceStatus.PENDING,
    due_date: new Date('2026-03-01'),
    issued_date: new Date('2026-02-15'),
  };

  const mockPayment: Partial<Payment> = {
    payment_id: '556e7890-e89b-12d3-a456-426614174003',
    invoice_id: mockInvoice.invoice_id,
    amount: 50.0,
    payment_date: new Date('2026-02-20'),
    status: PaymentStatus.PENDING_SUBMISSION,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPaymentsRepository = {
    findByProviderId: jest.fn(),
    create: jest.fn(),
    createForClub: jest.fn(),
    findAll: jest.fn(),
    findByInvoice: jest.fn(),
    findByStatus: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getTotalPaymentsByInvoice: jest.fn(),
    getTotalPaymentsByInvoiceForClub: jest.fn(),
  };

  const mockInvoicesRepository = {
    findOne: jest.fn(),
    findOneUnscoped: jest.fn(),
    findByStatus: jest.fn(),
    findByStatusUnscoped: jest.fn(),
    updateStatus: jest.fn(),
    update: jest.fn(),
  };

  const mockMandatesRepository = {
    findActiveByFamily: jest.fn(),
    findByFamily: jest.fn(),
    findByFamilyForClub: jest.fn(),
  };

  // The provider the registry resolves for the invoice's club. PaymentsService
  // now charges via this provider-neutral interface instead of GoCardlessService.
  const mockProvider = {
    connection: { provider: 'gocardless' },
    isConfigured: jest.fn(),
    startMandateSetup: jest.fn(),
    completeMandateSetup: jest.fn(),
    getMandateStatus: jest.fn(),
    cancelMandate: jest.fn(),
    chargeRecurring: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhookEvents: jest.fn(),
  };

  const mockPaymentProviders = {
    forClub: jest.fn().mockResolvedValue(mockProvider),
  };

  const mockFamiliesRepository = {
    findOne: jest.fn(),
  };

  const mockEmailService = {
    sendPaymentConfirmed: jest.fn().mockResolvedValue(undefined),
    sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
  };

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  const operations = { collect: jest.fn() };
  const balances = {
    recordManual: jest.fn(async (_club: string, dto: CreatePaymentDto) =>
      mockPaymentsRepository.create(dto),
    ),
    mutateManual: jest.fn(async (_club: string, payment: Payment, dto: UpdatePaymentDto | null) =>
      dto
        ? mockPaymentsRepository.update(payment.payment_id, dto)
        : mockPaymentsRepository.remove(payment.payment_id),
    ),
    invoice: jest.fn(async () => ({ balance: { due_minor: 0 } })),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: BillingBalanceService, useValue: balances },
        { provide: PaymentOperationsService, useValue: operations },
        { provide: PaymentsRepository, useValue: mockPaymentsRepository },
        { provide: InvoicesRepository, useValue: mockInvoicesRepository },
        { provide: MandatesRepository, useValue: mockMandatesRepository },
        { provide: PaymentProviderRegistry, useValue: mockPaymentProviders },
        { provide: FamiliesRepository, useValue: mockFamiliesRepository },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ClubsRepository, useValue: mockClubsRepository },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    _paymentsRepository = module.get<PaymentsRepository>(PaymentsRepository);
    _invoicesRepository = module.get<InvoicesRepository>(InvoicesRepository);

    // Re-establish provider resolution after clearAllMocks() between tests.
    mockPaymentProviders.forClub.mockResolvedValue(mockProvider);
    mockProvider.connection.provider = 'gocardless';
    operations.collect.mockResolvedValue(null);

    // Default: a GB club, mirroring an existing UK club. Individual tests
    // override this to exercise other regions.
    mockClubsRepository.findOne.mockResolvedValue({
      id: CLUB_ID,
      country: 'GB',
      currency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
    });
    mockFamiliesRepository.findOne.mockResolvedValue({
      family_id: mockInvoice.family_id,
      family_name: 'The Smiths',
      primary_contact_email: 'jane.smith@example.com',
    });
  });

  // The payment notification is dispatched from a fire-and-forget async IIFE,
  // so flush the microtask queue before asserting on the email mock.
  const flushNotification = () => new Promise((resolve) => setImmediate(resolve));

  afterEach(() => {
    jest.clearAllMocks();
    mockPaymentsRepository.getTotalPaymentsByInvoice.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a payment', async () => {
      const createDto = {
        invoice_id: mockInvoice.invoice_id,
        amount: 50.0,
        payment_date: new Date('2026-02-20'),
        method: PaymentMethod.CASH,
        status: PaymentStatus.CONFIRMED,
      };

      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockPaymentsRepository.getTotalPaymentsByInvoice.mockResolvedValue(0);
      mockPaymentsRepository.create.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.CONFIRMED,
      });
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);
      mockPaymentsRepository.getTotalPaymentsByInvoice
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50);

      const result = await service.create(createDto as unknown as CreatePaymentDto);

      expect(result).toBeDefined();
      expect(mockPaymentsRepository.create).toHaveBeenCalledWith({
        ...createDto,
        currency: 'GBP',
      });
    });

    it('should throw NotFoundException if invoice does not exist', async () => {
      const createDto = {
        invoice_id: 'non-existent-invoice',
        amount: 50.0,
        payment_date: new Date(),
        method: PaymentMethod.CASH,
        status: PaymentStatus.CONFIRMED,
      };

      mockInvoicesRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto as unknown as CreatePaymentDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPaymentsRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if payment amount exceeds remaining balance', async () => {
      const createDto = {
        invoice_id: mockInvoice.invoice_id,
        amount: 100.0,
        payment_date: new Date(),
        method: PaymentMethod.CASH,
        status: PaymentStatus.CONFIRMED,
      };

      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockPaymentsRepository.getTotalPaymentsByInvoice.mockResolvedValue(10.0);

      await expect(service.create(createDto as unknown as CreatePaymentDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPaymentsRepository.create).not.toHaveBeenCalled();
    });

    it('should update invoice status to PAID when a CONFIRMED payment is created', async () => {
      const createDto = {
        invoice_id: mockInvoice.invoice_id,
        amount: 50.0,
        payment_date: new Date(),
        method: PaymentMethod.CARD,
        status: PaymentStatus.CONFIRMED,
      };

      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockPaymentsRepository.getTotalPaymentsByInvoice
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50.0);
      mockPaymentsRepository.create.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.CONFIRMED,
      });
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.create(createDto as unknown as CreatePaymentDto);

      expect(mockInvoicesRepository.updateStatus).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      mockPaymentsRepository.findAll.mockResolvedValue([mockPayment]);

      const result = await service.findAll();

      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findByInvoice', () => {
    it('should return payments for a specific invoice', async () => {
      mockPaymentsRepository.findByInvoice.mockResolvedValue([mockPayment]);

      const result = await service.findByInvoice(mockInvoice.invoice_id);

      expect(result).toEqual([mockPayment]);
      expect(mockPaymentsRepository.findByInvoice).toHaveBeenCalledWith(mockInvoice.invoice_id);
    });
  });

  describe('findByStatus', () => {
    it('should return payments with a specific status', async () => {
      mockPaymentsRepository.findByStatus.mockResolvedValue([mockPayment]);

      const result = await service.findByStatus(PaymentStatus.PENDING_SUBMISSION);

      expect(result).toEqual([mockPayment]);
      expect(mockPaymentsRepository.findByStatus).toHaveBeenCalledWith(
        PaymentStatus.PENDING_SUBMISSION,
      );
    });
  });

  describe('findOne', () => {
    it('should return a single payment', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne(mockPayment.payment_id as string);

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a payment', async () => {
      const updateDto = { status: PaymentStatus.CONFIRMED };
      const updatedPayment = { ...mockPayment, status: PaymentStatus.CONFIRMED };

      mockPaymentsRepository.findOne
        .mockResolvedValueOnce(mockPayment)
        .mockResolvedValueOnce(mockPayment);
      mockPaymentsRepository.update.mockResolvedValue(updatedPayment);
      mockPaymentsRepository.getTotalPaymentsByInvoice.mockResolvedValue(50.0);
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      const result = await service.update(
        mockPayment.payment_id as string,
        updateDto as UpdatePaymentDto,
      );

      expect(result.status).toBe(PaymentStatus.CONFIRMED);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(null);
      mockPaymentsRepository.update.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { status: PaymentStatus.CONFIRMED } as UpdatePaymentDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a payment', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(mockPayment);
      mockPaymentsRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockPayment.payment_id as string);

      expect(mockPaymentsRepository.remove).toHaveBeenCalledWith(mockPayment.payment_id);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      mockPaymentsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('collectDirectDebitPayment', () => {
    it('derives the club from the invoice and delegates to the durable operation workflow', async () => {
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      operations.collect.mockResolvedValue({
        payment_id: mockPayment.payment_id,
        provider: 'stripe',
        provider_id: 'pi_test',
      });
      mockPaymentsRepository.findByProviderId.mockResolvedValue(mockPayment);
      expect(await service.collectDirectDebitPayment(mockInvoice.invoice_id)).toEqual(mockPayment);
      expect(operations.collect).toHaveBeenCalledWith(CLUB_ID, mockInvoice.invoice_id);
      expect(mockProvider.chargeRecurring).not.toHaveBeenCalled();
    });
    it('does not fabricate a payment for an uncertain or skipped operation', async () => {
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      operations.collect.mockResolvedValue({ payment_id: null, state: 'uncertain' });
      expect(await service.collectDirectDebitPayment(mockInvoice.invoice_id)).toBeNull();
    });
    it('rejects an unknown invoice before any provider operation', async () => {
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(null);
      await expect(service.collectDirectDebitPayment(mockInvoice.invoice_id)).rejects.toThrow(
        NotFoundException,
      );
      expect(operations.collect).not.toHaveBeenCalled();
    });
  });

  describe('payment confirmation notification', () => {
    const confirmedDto = {
      invoice_id: mockInvoice.invoice_id,
      amount: 50.0,
      payment_date: new Date('2026-02-20'),
      method: PaymentMethod.CASH,
      status: PaymentStatus.CONFIRMED,
    };

    const confirmedPayment = {
      ...mockPayment,
      status: PaymentStatus.CONFIRMED,
      amount: 50.0,
      payment_date: new Date('2026-02-20'),
    };

    it('should send a GB confirmation email with pound amount and day/month/year date', async () => {
      mockInvoicesRepository.findOne.mockResolvedValue(mockInvoice);
      mockPaymentsRepository.getTotalPaymentsByInvoice
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50.0);
      mockPaymentsRepository.create.mockResolvedValue({ ...confirmedPayment, currency: 'GBP' });
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.create(confirmedDto as unknown as CreatePaymentDto);
      await flushNotification();

      expect(mockEmailService.sendPaymentConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAmount: '£50.00',
          paymentDate: '20/02/2026',
          paymentMethod: 'Direct Debit',
        }),
      );
    });

    it('should send a US confirmation email with dollar amount, month-first date and ACH label', async () => {
      const usInvoice = { ...mockInvoice, currency: 'USD' };
      mockClubsRepository.findOne.mockResolvedValue({
        id: CLUB_ID,
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
      });
      mockInvoicesRepository.findOne.mockResolvedValue(usInvoice);
      mockPaymentsRepository.getTotalPaymentsByInvoice
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(50.0);
      // No stored payment_method, so the region fallback label is used.
      mockPaymentsRepository.create.mockResolvedValue({
        ...confirmedPayment,
        currency: 'USD',
        payment_method: null,
      });
      mockInvoicesRepository.updateStatus.mockResolvedValue(undefined);

      await service.create(confirmedDto as unknown as CreatePaymentDto);
      await flushNotification();

      // payment_date is a date-only column, so the stored calendar date
      // renders as-is (month-first for en-US) and never shifts with the
      // club's timezone.
      expect(mockEmailService.sendPaymentConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAmount: '$50.00',
          paymentDate: '2/20/2026',
          paymentMethod: 'ACH bank debit',
        }),
      );
    });
  });
});
