import { WebhooksService, GoCardlessWebhookEvent } from './webhooks.service';
import { DirectDebitMandateStatus } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { PaymentStatus } from '../finance/payments/entities/payment.entity';

describe('WebhooksService', () => {
  let service: WebhooksService;

  const mockMandatesRepository = {
    findByProviderId: jest.fn(),
    updateStatusForClub: jest.fn(),
  };

  const mockPaymentsRepository = {
    findByProviderId: jest.fn(),
    updatePaymentStatusForClub: jest.fn(),
  };

  const mockInvoicesRepository = {
    findOneUnscoped: jest.fn(),
  };

  const mockFamiliesRepository = {
    findOneUnscoped: jest.fn(),
  };

  const mockEmailService = {
    sendMandateConfirmed: jest.fn(),
    sendPaymentConfirmed: jest.fn(),
    sendPaymentFailed: jest.fn(),
  };

  const mockClubsRepository = {
    findOne: jest.fn(),
  };

  // A GB club must produce byte-identical email strings to before the region
  // work, so most tests resolve to this club.
  const gbClub = {
    id: 'uuid-club-1',
    country: 'GB',
    currency: 'GBP',
    locale: 'en-GB',
    timezone: 'Europe/London',
  };

  beforeEach(() => {
    service = new WebhooksService(
      mockMandatesRepository as any,
      mockPaymentsRepository as any,
      mockInvoicesRepository as any,
      mockFamiliesRepository as any,
      mockEmailService as any,
      mockClubsRepository as any,
    );

    jest.clearAllMocks();
    mockClubsRepository.findOne.mockResolvedValue(gbClub);
  });

  const createMandateEvent = (action: string): GoCardlessWebhookEvent => ({
    id: `EV-MANDATE-${action}`,
    resource_type: 'mandates',
    action,
    links: { mandate: 'MD000001' },
  });

  const createPaymentEvent = (action: string): GoCardlessWebhookEvent => ({
    id: `EV-PAYMENT-${action}`,
    resource_type: 'payments',
    action,
    links: { payment: 'PM000001' },
  });

  const mockMandate = {
    mandate_id: 'uuid-mandate-1',
    family_id: 'uuid-family-1',
    club_id: 'uuid-club-1',
    provider_mandate_id: 'MD000001',
    status: DirectDebitMandateStatus.ACTIVE,
  };

  const mockPayment = {
    payment_id: 'uuid-payment-1',
    invoice_id: 'uuid-invoice-1',
    club_id: 'uuid-club-1',
    amount: 25.5,
    // The payment_date column is date-only; TypeORM returns it as a string.
    payment_date: '2026-04-01',
    payment_method: 'direct_debit',
    status: PaymentStatus.PENDING_SUBMISSION,
    reference_number: 'REF-001',
  };

  const mockFamily = {
    family_id: 'uuid-family-1',
    family_name: 'Smith',
    primary_contact_email: 'smith@example.com',
  };

  const mockInvoice = {
    invoice_id: 'uuid-invoice-1',
    family_id: 'uuid-family-1',
    invoice_number: 'INV-2026-001',
  };

  describe('tenant routing', () => {
    // A connected account can only emit events about its own club's records, so
    // the club the provider routed to and the club owning the record must agree.
    // A mismatch means a connection is mapped to the wrong club or a record id
    // was guessed; acting on it would mutate one club's billing from another
    // club's webhook.
    beforeEach(() => {
      mockMandatesRepository.findByProviderId.mockResolvedValue({ ...mockMandate });
      mockPaymentsRepository.findByProviderId.mockResolvedValue({ ...mockPayment });
      mockFamiliesRepository.findOneUnscoped.mockResolvedValue(mockFamily);
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
    });

    it('processes a mandate event when the routed club owns the mandate', async () => {
      await service.handleEvent(createMandateEvent('cancelled'), 'uuid-club-1');

      expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalled();
    });

    it('DROPS a mandate event routed to a different club than owns the mandate', async () => {
      await service.handleEvent(createMandateEvent('cancelled'), 'uuid-club-SOMEONE-ELSE');

      expect(mockMandatesRepository.updateStatusForClub).not.toHaveBeenCalled();
    });

    it('DROPS a payment event routed to a different club than owns the payment', async () => {
      await service.handleEvent(createPaymentEvent('confirmed'), 'uuid-club-SOMEONE-ELSE');

      expect(mockPaymentsRepository.updatePaymentStatusForClub).not.toHaveBeenCalled();
    });

    it('processes an unrouted event, falling back to the record club (legacy account)', async () => {
      // Swimly's own account serves every club and names none, so there is
      // nothing to cross-check and the record's own club stands.
      await service.handleEvent(createMandateEvent('cancelled'), null);

      expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalled();
    });

    it('defaults to the legacy behaviour when no routed club is supplied at all', async () => {
      await service.handleEvent(createMandateEvent('cancelled'));

      expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalled();
    });

    it('looks up records under the provider it is told (default gocardless)', async () => {
      await service.handleEvent(createPaymentEvent('confirmed'), 'uuid-club-1');

      expect(mockPaymentsRepository.findByProviderId).toHaveBeenCalledWith(
        'gocardless',
        'PM000001',
      );
    });

    it('looks up records under stripe when handling a stripe event', async () => {
      // The Stripe controller passes 'stripe'; the payment row was written with
      // provider='stripe', so the lookup must match or the event finds nothing.
      await service.handleEvent(createPaymentEvent('confirmed'), 'uuid-club-1', 'stripe');

      expect(mockPaymentsRepository.findByProviderId).toHaveBeenCalledWith('stripe', 'PM000001');
    });
  });

  describe('mandate events', () => {
    beforeEach(() => {
      mockMandatesRepository.findByProviderId.mockResolvedValue({ ...mockMandate });
      mockFamiliesRepository.findOneUnscoped.mockResolvedValue(mockFamily);
      mockEmailService.sendMandateConfirmed.mockResolvedValue(undefined);
    });

    it.each([
      ['created', DirectDebitMandateStatus.PENDING],
      ['submitted', DirectDebitMandateStatus.PENDING],
      ['reinstated', DirectDebitMandateStatus.PENDING],
    ])(
      'should set mandate to PENDING for "%s" action',
      async (action: string, expectedStatus: DirectDebitMandateStatus) => {
        await service.handleEvent(createMandateEvent(action));

        expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalledWith(
          mockMandate.mandate_id,
          mockMandate.club_id,
          expectedStatus,
        );
      },
    );

    it('should set mandate to ACTIVE for "active" action', async () => {
      mockMandatesRepository.findByProviderId.mockResolvedValue({
        ...mockMandate,
        status: DirectDebitMandateStatus.PENDING,
      });

      await service.handleEvent(createMandateEvent('active'));

      expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalledWith(
        mockMandate.mandate_id,
        mockMandate.club_id,
        DirectDebitMandateStatus.ACTIVE,
      );
    });

    it.each(['cancelled', 'expired'])(
      'should set mandate to CANCELLED for "%s" action',
      async (action: string) => {
        await service.handleEvent(createMandateEvent(action));

        expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalledWith(
          mockMandate.mandate_id,
          mockMandate.club_id,
          DirectDebitMandateStatus.CANCELLED,
        );
      },
    );

    it('should set mandate to FAILED for "failed" action', async () => {
      await service.handleEvent(createMandateEvent('failed'));

      expect(mockMandatesRepository.updateStatusForClub).toHaveBeenCalledWith(
        mockMandate.mandate_id,
        mockMandate.club_id,
        DirectDebitMandateStatus.FAILED,
      );
    });

    it('should send confirmation email when mandate becomes active', async () => {
      mockMandatesRepository.findByProviderId.mockResolvedValue({
        ...mockMandate,
        status: DirectDebitMandateStatus.PENDING,
      });

      await service.handleEvent(createMandateEvent('active'));

      expect(mockEmailService.sendMandateConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          familyName: 'Smith',
          recipientEmail: 'smith@example.com',
          mandateReference: 'MD000001',
        }),
      );
    });

    it('should not send email for non-active status changes', async () => {
      await service.handleEvent(createMandateEvent('created'));

      expect(mockEmailService.sendMandateConfirmed).not.toHaveBeenCalled();
    });

    it('should not update status when the status has not changed', async () => {
      mockMandatesRepository.findByProviderId.mockResolvedValue({
        ...mockMandate,
        status: DirectDebitMandateStatus.ACTIVE,
      });

      await service.handleEvent(createMandateEvent('active'));

      expect(mockMandatesRepository.updateStatusForClub).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      mockEmailService.sendMandateConfirmed.mockRejectedValue(new Error('SMTP error'));

      // Should not throw
      await expect(service.handleEvent(createMandateEvent('active'))).resolves.not.toThrow();
    });
  });

  describe('payment events', () => {
    beforeEach(() => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue({ ...mockPayment });
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockFamiliesRepository.findOneUnscoped.mockResolvedValue(mockFamily);
      mockEmailService.sendPaymentConfirmed.mockResolvedValue(undefined);
      mockEmailService.sendPaymentFailed.mockResolvedValue(undefined);
    });

    it.each(['created', 'submitted'])(
      'should set payment to SUBMITTED for "%s" action',
      async (action: string) => {
        await service.handleEvent(createPaymentEvent(action));

        expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
          mockPayment.payment_id,
          mockPayment.club_id,
          PaymentStatus.SUBMITTED,
        );
      },
    );

    it.each(['confirmed', 'paid_out'])(
      'should set payment to CONFIRMED for "%s" action',
      async (action: string) => {
        await service.handleEvent(createPaymentEvent(action));

        expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
          mockPayment.payment_id,
          mockPayment.club_id,
          PaymentStatus.CONFIRMED,
        );
      },
    );

    it.each(['failed', 'charged_back', 'cancelled'])(
      'should set payment to FAILED for "%s" action',
      async (action: string) => {
        await service.handleEvent(createPaymentEvent(action));

        expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
          mockPayment.payment_id,
          mockPayment.club_id,
          PaymentStatus.FAILED,
        );
      },
    );

    it('should send confirmation email when payment is confirmed', async () => {
      await service.handleEvent(createPaymentEvent('confirmed'));

      expect(mockEmailService.sendPaymentConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          familyName: 'Smith',
          recipientEmail: 'smith@example.com',
          invoiceNumber: 'INV-2026-001',
        }),
      );
    });

    it('should format a GB club payment-confirmed email with pound and day-first date', async () => {
      await service.handleEvent(createPaymentEvent('confirmed'));

      expect(mockEmailService.sendPaymentConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAmount: '£25.50',
          paymentDate: '01/04/2026',
          paymentMethod: 'Direct Debit',
        }),
      );
    });

    it('should format a US club payment-confirmed email with dollar and month-first date', async () => {
      mockClubsRepository.findOne.mockResolvedValue({
        id: 'uuid-club-1',
        country: 'US',
        currency: 'USD',
        locale: 'en-US',
        timezone: 'America/New_York',
      });

      await service.handleEvent(createPaymentEvent('confirmed'));

      // payment_date is a date-only value, so the stored calendar day must not
      // shift a day earlier under the club's negative-offset timezone. The
      // assertion is dollar amount plus month-first date.
      expect(mockEmailService.sendPaymentConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAmount: '$25.50',
          paymentDate: '4/1/2026',
          paymentMethod: 'ACH bank debit',
        }),
      );
    });

    it('should fall back to GB formatting when the club cannot be resolved', async () => {
      mockClubsRepository.findOne.mockResolvedValue(null);

      await service.handleEvent(createPaymentEvent('confirmed'));

      expect(mockEmailService.sendPaymentConfirmed).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAmount: '£25.50',
          paymentMethod: 'Direct Debit',
        }),
      );
    });

    it('should send failure email when payment fails', async () => {
      await service.handleEvent(createPaymentEvent('failed'));

      expect(mockEmailService.sendPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          familyName: 'Smith',
          recipientEmail: 'smith@example.com',
          invoiceNumber: 'INV-2026-001',
          failureReason: 'Payment was unsuccessful',
        }),
      );
    });

    it('should not update status when the status has not changed', async () => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.SUBMITTED,
      });

      await service.handleEvent(createPaymentEvent('submitted'));

      expect(mockPaymentsRepository.updatePaymentStatusForClub).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully for confirmed payments', async () => {
      mockEmailService.sendPaymentConfirmed.mockRejectedValue(new Error('SMTP error'));

      await expect(service.handleEvent(createPaymentEvent('confirmed'))).resolves.not.toThrow();
    });

    it('should handle email sending failure gracefully for failed payments', async () => {
      mockEmailService.sendPaymentFailed.mockRejectedValue(new Error('SMTP error'));

      await expect(service.handleEvent(createPaymentEvent('failed'))).resolves.not.toThrow();
    });
  });

  describe('payment failure reasons', () => {
    const createFailedEvent = (
      action: string,
      details?: GoCardlessWebhookEvent['details'],
    ): GoCardlessWebhookEvent => ({
      ...createPaymentEvent(action),
      details,
    });

    beforeEach(() => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue({ ...mockPayment });
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockFamiliesRepository.findOneUnscoped.mockResolvedValue(mockFamily);
      mockEmailService.sendPaymentFailed.mockResolvedValue(undefined);
    });

    it('persists the normalised cause and description on a failed event with details', async () => {
      await service.handleEvent(
        createFailedEvent('failed', {
          origin: 'bank',
          cause: 'insufficient_funds',
          description: "Customer's account has insufficient funds",
          reason_code: '0',
          scheme: 'bacs',
        }),
      );

      expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
        mockPayment.payment_id,
        mockPayment.club_id,
        PaymentStatus.FAILED,
        {
          cause: 'insufficient_funds',
          description: "Customer's account has insufficient funds",
        },
      );
    });

    it('emails the mapped payer-facing copy for a known cause', async () => {
      await service.handleEvent(
        createFailedEvent('failed', {
          cause: 'insufficient_funds',
          description: "Customer's account has insufficient funds",
        }),
      );

      expect(mockEmailService.sendPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason:
            'There were insufficient funds in the account when the payment was attempted.',
          hasSpecificFailureReason: true,
        }),
      );
    });

    it('maps a BECS failure to the same scheme-neutral copy as Bacs', async () => {
      // GoCardless normalises the cause across schemes, so an Australian BECS
      // return arrives with the same cause value as its Bacs equivalent.
      await service.handleEvent(
        createFailedEvent('failed', {
          cause: 'refer_to_payer',
          description: 'The customer bank could not process this payment',
          reason_code: '5',
          scheme: 'becs',
        }),
      );

      expect(mockEmailService.sendPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: 'The bank declined the payment. Contact your bank, then retry.',
          hasSpecificFailureReason: true,
        }),
      );
    });

    it('falls back to the sentence-cased GoCardless description for an unmapped cause', async () => {
      await service.handleEvent(
        createFailedEvent('failed', {
          cause: 'test_failure',
          description: 'payment was deliberately failed in the sandbox',
        }),
      );

      expect(mockEmailService.sendPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: 'Payment was deliberately failed in the sandbox',
          hasSpecificFailureReason: true,
        }),
      );
    });

    it('truncates an overlong description to 255 characters before persisting', async () => {
      const longDescription = 'x'.repeat(300);
      await service.handleEvent(
        createFailedEvent('failed', { cause: 'other', description: longDescription }),
      );

      expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
        mockPayment.payment_id,
        mockPayment.club_id,
        PaymentStatus.FAILED,
        { cause: 'other', description: 'x'.repeat(255) },
      );
    });

    it('captures the cause on a charged_back event too', async () => {
      await service.handleEvent(
        createFailedEvent('charged_back', {
          cause: 'authorisation_disputed',
          description: 'The customer disputes having authorised you',
        }),
      );

      expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
        mockPayment.payment_id,
        mockPayment.club_id,
        PaymentStatus.FAILED,
        {
          cause: 'authorisation_disputed',
          description: 'The customer disputes having authorised you',
        },
      );
      expect(mockEmailService.sendPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason:
            'The account holder disputed the Direct Debit authorisation. Please contact the club.',
          hasSpecificFailureReason: true,
        }),
      );
    });

    it('behaves exactly as before for a failed event without details', async () => {
      await service.handleEvent(createPaymentEvent('failed'));

      // Persist path: the pre-existing three-argument call, no failure fields.
      expect(mockPaymentsRepository.updatePaymentStatusForClub).toHaveBeenCalledWith(
        mockPayment.payment_id,
        mockPayment.club_id,
        PaymentStatus.FAILED,
      );
      // Email path: the pre-existing generic copy, byte for byte, with the
      // specific-reason flag off so the template's generic list still renders.
      expect(mockEmailService.sendPaymentFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          failureReason: 'Payment was unsuccessful',
          hasSpecificFailureReason: false,
        }),
      );
    });
  });

  describe('missing record handling', () => {
    it('should handle missing mandate gracefully', async () => {
      mockMandatesRepository.findByProviderId.mockResolvedValue(null);

      await expect(service.handleEvent(createMandateEvent('active'))).resolves.not.toThrow();
      expect(mockMandatesRepository.updateStatusForClub).not.toHaveBeenCalled();
    });

    it('should handle missing payment gracefully', async () => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue(null);

      await expect(service.handleEvent(createPaymentEvent('confirmed'))).resolves.not.toThrow();
      expect(mockPaymentsRepository.updatePaymentStatusForClub).not.toHaveBeenCalled();
    });

    it('should handle missing invoice gracefully', async () => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue({ ...mockPayment });
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(null);

      await expect(service.handleEvent(createPaymentEvent('confirmed'))).resolves.not.toThrow();
    });

    it('should handle missing family gracefully', async () => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue({ ...mockPayment });
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockFamiliesRepository.findOneUnscoped.mockResolvedValue(null);

      await expect(service.handleEvent(createPaymentEvent('confirmed'))).resolves.not.toThrow();
    });

    it('should handle family with no email gracefully', async () => {
      mockPaymentsRepository.findByProviderId.mockResolvedValue({ ...mockPayment });
      mockInvoicesRepository.findOneUnscoped.mockResolvedValue(mockInvoice);
      mockFamiliesRepository.findOneUnscoped.mockResolvedValue({
        ...mockFamily,
        primary_contact_email: null,
      });

      await expect(service.handleEvent(createPaymentEvent('confirmed'))).resolves.not.toThrow();
      expect(mockEmailService.sendPaymentConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('unknown event types', () => {
    it('should handle subscription events without error', async () => {
      const event: GoCardlessWebhookEvent = {
        id: 'EV-SUB-001',
        resource_type: 'subscriptions',
        action: 'created',
        links: { subscription: 'SB000001' },
      };

      await expect(service.handleEvent(event)).resolves.not.toThrow();
    });

    it('should handle unknown resource types without error', async () => {
      const event: GoCardlessWebhookEvent = {
        id: 'EV-UNKNOWN-001',
        resource_type: 'refunds',
        action: 'created',
        links: { refund: 'RF000001' },
      };

      await expect(service.handleEvent(event)).resolves.not.toThrow();
    });
  });
});
