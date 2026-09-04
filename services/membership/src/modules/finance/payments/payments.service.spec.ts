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
import { DirectDebitMandateStatus } from '../mandates/entities/direct-debit-mandate.entity';
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

  const mockMandate = {
    mandate_id: '667e8901-e89b-12d3-a456-426614174004',
    family_id: mockInvoice.family_id,
    provider_mandate_id: 'MD001ABC',
    status: DirectDebitMandateStatus.ACTIVE,
    scheme: 'bacs',
  };

  const mockPaymentsRepository = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
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
    it('should return null if no active mandate exists for the family', async () => {
      // Non-request path: derives the club from the loaded invoice via the
      // unscoped repository variants rather than the CLS context.
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockMandatesRepository.findByFamilyForClub.mockResolvedValue([]);

      const result = await service.collectDirectDebitPayment(mockInvoice.invoice_id);

      expect(result).toBeNull();
      expect(mockProvider.chargeRecurring).not.toHaveBeenCalled();
    });

    it('should return null if the invoice is already paid', async () => {
      const paidInvoice = { ...mockInvoice, status: InvoiceStatus.PAID };
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(paidInvoice);
      mockMandatesRepository.findActiveByFamily.mockResolvedValue(mockMandate);

      const result = await service.collectDirectDebitPayment(paidInvoice.invoice_id);

      expect(result).toBeNull();
    });

    describe('idempotency', () => {
      const arrangeCollection = (totalPaid = 0) => {
        mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
        mockMandatesRepository.findByFamilyForClub.mockResolvedValue([mockMandate]);
        mockPaymentsRepository.getTotalPaymentsByInvoiceForClub.mockResolvedValue(totalPaid);
        mockProvider.chargeRecurring.mockResolvedValue({ providerPaymentId: 'PM001' });
        mockPaymentsRepository.createForClub.mockResolvedValue(mockPayment);
      };

      it('sends an idempotency key derived from the invoice and amount', async () => {
        // The charge happens before the payment row is written, so a crash in
        // between would otherwise let a retry charge the payer twice.
        arrangeCollection(0);

        await service.collectDirectDebitPayment(mockInvoice.invoice_id);

        expect(mockProvider.chargeRecurring).toHaveBeenCalledWith(
          expect.objectContaining({
            idempotencyKey: `invoice-${mockInvoice.invoice_id}-5000`,
          }),
        );
      });

      it('produces the SAME key when a lost payment is retried', async () => {
        // The crash case: the payment row never landed, so totalPaid is still 0
        // and the retry recomputes an identical amount. Same key means the
        // provider returns the original payment rather than taking more money.
        arrangeCollection(0);
        await service.collectDirectDebitPayment(mockInvoice.invoice_id);
        const first = mockProvider.chargeRecurring.mock.calls[0][0].idempotencyKey;

        mockProvider.chargeRecurring.mockClear();
        arrangeCollection(0);
        await service.collectDirectDebitPayment(mockInvoice.invoice_id);
        const second = mockProvider.chargeRecurring.mock.calls[0][0].idempotencyKey;

        expect(second).toBe(first);
      });

      it('produces a DIFFERENT key when collecting a different remaining balance', async () => {
        // A genuine later collection of the rest of an invoice must not be
        // swallowed as a duplicate.
        arrangeCollection(0);
        await service.collectDirectDebitPayment(mockInvoice.invoice_id);
        const full = mockProvider.chargeRecurring.mock.calls[0][0].idempotencyKey;

        mockProvider.chargeRecurring.mockClear();
        arrangeCollection(20);
        await service.collectDirectDebitPayment(mockInvoice.invoice_id);
        const remainder = mockProvider.chargeRecurring.mock.calls[0][0].idempotencyKey;

        expect(remainder).not.toBe(full);
        expect(remainder).toBe(`invoice-${mockInvoice.invoice_id}-3000`);
      });
    });

    it('should collect a GBP invoice in GBP (existing UK behaviour is unchanged)', async () => {
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockMandatesRepository.findByFamilyForClub.mockResolvedValue([mockMandate]);
      mockPaymentsRepository.getTotalPaymentsByInvoiceForClub.mockResolvedValue(0);
      mockProvider.chargeRecurring.mockResolvedValue({ providerPaymentId: 'PM001GBP' });
      mockPaymentsRepository.createForClub.mockResolvedValue({
        ...mockPayment,
        currency: 'GBP',
      });

      await service.collectDirectDebitPayment(mockInvoice.invoice_id);

      // The provider is charged in the invoice's currency, not a hard-coded 'GBP',
      // against the same GoCardless mandate id as before.
      expect(mockProvider.chargeRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50.0,
          currency: 'GBP',
          providerMandateId: mockMandate.provider_mandate_id,
        }),
      );
      // The persisted payment is stamped with the same currency, scoped to the
      // club derived from the parent invoice.
      expect(mockPaymentsRepository.createForClub).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'GBP', amount: 50.0 }),
        CLUB_ID,
      );
      // The club fallback is never consulted when the invoice carries a currency.
      expect(mockClubsRepository.findOne).not.toHaveBeenCalled();
    });

    it("should collect a non-GBP invoice in the invoice's currency", async () => {
      const usdInvoice = { ...mockInvoice, currency: 'USD' };
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(usdInvoice);
      mockMandatesRepository.findByFamilyForClub.mockResolvedValue([mockMandate]);
      mockPaymentsRepository.getTotalPaymentsByInvoiceForClub.mockResolvedValue(0);
      mockProvider.chargeRecurring.mockResolvedValue({ providerPaymentId: 'PM001USD' });
      mockPaymentsRepository.createForClub.mockResolvedValue({
        ...mockPayment,
        currency: 'USD',
      });

      await service.collectDirectDebitPayment(usdInvoice.invoice_id);

      expect(mockProvider.chargeRecurring).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50.0, currency: 'USD' }),
      );
      expect(mockPaymentsRepository.createForClub).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
        CLUB_ID,
      );
    });

    it("should fall back to the club's currency when the invoice has none", async () => {
      // Legacy invoice without a stored currency: resolve via the owning club.
      const legacyInvoice = { ...mockInvoice, currency: undefined };
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(legacyInvoice);
      mockMandatesRepository.findByFamilyForClub.mockResolvedValue([mockMandate]);
      mockPaymentsRepository.getTotalPaymentsByInvoiceForClub.mockResolvedValue(0);
      mockClubsRepository.findOne.mockResolvedValue({ id: CLUB_ID, currency: 'CAD' });
      mockProvider.chargeRecurring.mockResolvedValue({ providerPaymentId: 'PM001CAD' });
      mockPaymentsRepository.createForClub.mockResolvedValue({
        ...mockPayment,
        currency: 'CAD',
      });

      await service.collectDirectDebitPayment(legacyInvoice.invoice_id);

      expect(mockClubsRepository.findOne).toHaveBeenCalledWith(CLUB_ID);
      expect(mockProvider.chargeRecurring).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'CAD' }),
      );
      expect(mockPaymentsRepository.createForClub).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'CAD' }),
        CLUB_ID,
      );
    });

    it("charges with the mandate's customer and stamps the bound provider", async () => {
      // A Stripe club: the mandate carries the Stripe customer the payment
      // method is attached to, and the payment row must be stamped 'stripe' so
      // Stripe webhooks (which look up by provider AND provider id) find it.
      mockProvider.connection.provider = 'stripe';
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockMandatesRepository.findByFamilyForClub.mockResolvedValue([
        {
          ...mockMandate,
          provider: 'stripe',
          provider_mandate_id: 'pm_123',
          provider_customer_id: 'cus_123',
        },
      ]);
      mockPaymentsRepository.getTotalPaymentsByInvoiceForClub.mockResolvedValue(0);
      mockProvider.chargeRecurring.mockResolvedValue({ providerPaymentId: 'pi_1' });
      mockPaymentsRepository.createForClub.mockResolvedValue(mockPayment);

      await service.collectDirectDebitPayment(mockInvoice.invoice_id);

      expect(mockProvider.chargeRecurring).toHaveBeenCalledWith(
        expect.objectContaining({
          providerMandateId: 'pm_123',
          providerCustomerId: 'cus_123',
        }),
      );
      expect(mockPaymentsRepository.createForClub).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'stripe', provider_payment_id: 'pi_1' }),
        CLUB_ID,
      );
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
