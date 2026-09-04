import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { EmailService } from './email.service';

// Node makes the `fs` module's properties non-configurable, so jest.spyOn on
// readFileSync throws "Cannot redefine property". Mock the module instead and
// keep the real implementation for everything except the template read.
jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return { ...actual, readFileSync: jest.fn() };
});

jest.mock('resend', () => {
  const sendMock = jest.fn();
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send: sendMock },
    })),
    __sendMock: sendMock,
  };
});

const { __sendMock: sendMock } = jest.requireMock('resend') as { __sendMock: jest.Mock };

describe('EmailService', () => {
  let service: EmailService;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        CLUB_NAME: 'Test Swimming Club',
        APP_URL: 'https://app.test.com',
        RESEND_API_KEY: 're_test_key',
        EMAIL_FROM: 'Swimly <hello@updates.swimly.uk>',
        ACTIVATION_REPLY_TO: 'owner@example.com',
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue('<p>{{firstName}}</p>');
    sendMock.mockResolvedValue({ data: { id: 'eml_test_id' }, error: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendWelcome', () => {
    const data = {
      firstName: 'Alice',
      lastName: 'Green',
      email: 'alice@example.com',
      recipientEmail: 'alice@example.com',
      role: 'parent',
      loginUrl: 'https://app.test.com/login',
    };

    it('passes the right envelope to Resend', async () => {
      await service.sendWelcome(data);

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'Swimly <hello@updates.swimly.uk>',
          to: 'alice@example.com',
          subject: 'Welcome to Test Swimming Club!',
          html: expect.stringContaining('Alice'),
        }),
      );
    });

    it('throws when Resend returns an error', async () => {
      sendMock.mockResolvedValueOnce({
        data: null,
        error: { name: 'validation_error', message: 'invalid recipient' },
      });
      await expect(service.sendWelcome(data)).rejects.toThrow('invalid recipient');
    });
  });

  describe('sendInvoiceCreated', () => {
    const data = {
      familyName: 'Smith',
      recipientEmail: 'smith@example.com',
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-01-01',
      dueDate: '2026-01-31',
      totalAmount: '50.00',
      items: [{ description: 'Monthly fee', amount: '50.00' }],
    };

    it('passes the right envelope to Resend', async () => {
      await service.sendInvoiceCreated(data);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'smith@example.com',
          subject: 'New Invoice #INV-001 from Test Swimming Club',
        }),
      );
    });

    it('throws when Resend rejects', async () => {
      sendMock.mockRejectedValueOnce(new Error('Network blip'));
      await expect(service.sendInvoiceCreated(data)).rejects.toThrow('Network blip');
    });
  });

  describe('sendDBSExpiryWarning', () => {
    const base = {
      firstName: 'Alice',
      lastName: 'Green',
      recipientEmail: 'alice@example.com',
      certificateNumber: 'DBS-001',
      checkType: 'Enhanced DBS Check',
      issueDate: '01 January 2024',
      expiryDate: '01 February 2027',
      daysUntilExpiry: 14,
    };

    it('builds the GB subject unchanged when no framework name is given', async () => {
      await service.sendDBSExpiryWarning(base);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'DBS Check Expiring in 14 Days - Action Required',
        }),
      );
    });

    it('builds the subject from the framework name for a non-GB club', async () => {
      await service.sendDBSExpiryWarning({ ...base, frameworkName: 'SafeSport' });
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'SafeSport Check Expiring in 14 Days - Action Required',
        }),
      );
    });
  });

  describe('sendMandateConfirmed', () => {
    // Mirror the template's scheme conditional so the test proves the isBecs
    // flag reaches the Handlebars context and gates the protection copy.
    const schemeTemplate =
      '<p>{{#if isBecs}}Direct Debit Request Service Agreement{{else}}Direct Debit Guarantee{{/if}}</p>';

    const data = {
      familyName: 'Smith',
      recipientEmail: 'smith@example.com',
      mandateReference: 'MD000001',
      setupDate: '01 January 2026',
    };

    it('renders the GB Guarantee copy when no scheme is given', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(schemeTemplate);
      await service.sendMandateConfirmed(data);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Direct Debit Setup Complete - Test Swimming Club',
          html: expect.stringContaining('Direct Debit Guarantee'),
        }),
      );
    });

    it('renders the BECS Direct Debit Request copy for a becs-scheme club', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(schemeTemplate);
      await service.sendMandateConfirmed({ ...data, directDebitScheme: 'becs' });
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Direct Debit Request Service Agreement'),
        }),
      );
    });

    it('keeps the GB copy for non-becs schemes', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(schemeTemplate);
      await service.sendMandateConfirmed({ ...data, directDebitScheme: 'bacs' });
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Direct Debit Guarantee'),
        }),
      );
    });
  });

  describe('sendMandateSetupRequired', () => {
    const schemeTemplate =
      '<p>{{clubName}}: {{#if isBecs}}Direct Debit Request Service Agreement{{else}}Direct Debit Guarantee{{/if}}</p>';

    const data = {
      familyName: 'Smith',
      recipientEmail: 'smith@example.com',
      setupUrl: 'https://app.test.com/mandates/setup',
      clubName: 'Test Swimming Club',
    };

    it('renders the GB Guarantee copy when no scheme is given', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(schemeTemplate);
      await service.sendMandateSetupRequired(data);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Direct Debit Guarantee'),
        }),
      );
    });

    it('renders the BECS Direct Debit Request copy for a becs-scheme club', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(schemeTemplate);
      await service.sendMandateSetupRequired({ ...data, directDebitScheme: 'becs' });
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining('Direct Debit Request Service Agreement'),
        }),
      );
    });
  });

  describe('sendPaymentFailed', () => {
    // Mirror the template's failure-reason conditional so the test proves the
    // hasSpecificFailureReason flag reaches the Handlebars context and gates
    // the generic common-causes list.
    const reasonTemplate =
      '<p>Reason: {{failureReason}}</p>{{#if hasSpecificFailureReason}}<p>Why did this payment fail?</p>{{else}}<ul>Common reasons for payment failures</ul>{{/if}}';

    const data = {
      familyName: 'Smith',
      recipientEmail: 'smith@example.com',
      paymentAmount: '£25.50',
      invoiceNumber: 'INV-2026-001',
      failureReason: 'Payment was unsuccessful',
      retryDate: '04 April 2026',
    };

    it('renders the generic common-causes list when no specific cause is known', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(reasonTemplate);
      await service.sendPaymentFailed(data);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Payment Failed - Action Required - Test Swimming Club',
          html: expect.stringContaining('Common reasons for payment failures'),
        }),
      );
      expect(sendMock.mock.calls[0][0].html).toContain('Reason: Payment was unsuccessful');
    });

    it('renders the specific reason and drops the generic list when the cause is known', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(reasonTemplate);
      await service.sendPaymentFailed({
        ...data,
        failureReason:
          'There were insufficient funds in the account when the payment was attempted.',
        hasSpecificFailureReason: true,
      });
      const html = sendMock.mock.calls[0][0].html as string;
      expect(html).toContain('Why did this payment fail?');
      expect(html).toContain(
        'Reason: There were insufficient funds in the account when the payment was attempted.',
      );
      expect(html).not.toContain('Common reasons for payment failures');
    });

    it('renders the real template byte-identically with and without the new flag', async () => {
      // A no-details webhook now passes hasSpecificFailureReason: false where
      // it previously passed nothing. Rendering the real template both ways
      // and comparing byte for byte proves the added conditional is inert for
      // events without details, so those payers get exactly the email they
      // always did.
      const actualFs = jest.requireActual('fs') as typeof fs;
      const path = jest.requireActual('path') as { join: (...parts: string[]) => string };
      const realTemplate = actualFs.readFileSync(
        path.join(__dirname, 'templates', 'payment-failed.hbs'),
        'utf8',
      );
      (fs.readFileSync as jest.Mock).mockReturnValue(realTemplate);

      await service.sendPaymentFailed(data);
      await service.sendPaymentFailed({ ...data, hasSpecificFailureReason: false });

      const withoutFlag = sendMock.mock.calls[0][0].html as string;
      const withFlagOff = sendMock.mock.calls[1][0].html as string;
      expect(withoutFlag).toBe(withFlagOff);

      // The gated block is standalone-stripped by Handlebars, so the generic
      // list renders with exactly its original surrounding whitespace.
      expect(withoutFlag).toContain(
        '      <p><strong>Common reasons for payment failures:</strong></p>\n      <ul>',
      );
      expect(withoutFlag).not.toContain('Why did this payment fail?');
    });

    it('renders the real template with the specific reason and no generic list', async () => {
      const actualFs = jest.requireActual('fs') as typeof fs;
      const path = jest.requireActual('path') as { join: (...parts: string[]) => string };
      const realTemplate = actualFs.readFileSync(
        path.join(__dirname, 'templates', 'payment-failed.hbs'),
        'utf8',
      );
      (fs.readFileSync as jest.Mock).mockReturnValue(realTemplate);

      await service.sendPaymentFailed({
        ...data,
        failureReason: 'This bank account does not support Direct Debit.',
        hasSpecificFailureReason: true,
      });

      const html = sendMock.mock.calls[0][0].html as string;
      expect(html).toContain('Why did this payment fail?');
      expect(html).toContain('This bank account does not support Direct Debit.');
      expect(html).not.toContain('Common reasons for payment failures');
    });
  });

  describe('no-op when RESEND_API_KEY is missing', () => {
    it('does not call Resend and resolves quietly', async () => {
      const unconfigured: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, def?: string) => {
                if (key === 'RESEND_API_KEY' || key === 'EMAIL_PASSWORD') return undefined;
                return def;
              }),
            },
          },
        ],
      }).compile();
      const offline = unconfigured.get<EmailService>(EmailService);

      sendMock.mockClear();
      await offline.sendWelcome({
        firstName: 'X',
        lastName: 'Y',
        email: 'x@y.com',
        recipientEmail: 'x@y.com',
        role: 'parent',
        loginUrl: 'http://x',
      });
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe tokens', () => {
    it('round-trips a generated token', () => {
      const url = service.buildUnsubscribeUrl('parent@example.com');
      const token = new URL(url).searchParams.get('token') as string;

      expect(url).toContain('/unsubscribe?email=parent%40example.com');
      expect(service.verifyUnsubscribeToken('parent@example.com', token)).toBe(true);
      expect(service.verifyUnsubscribeToken('other@example.com', token)).toBe(false);
      expect(service.verifyUnsubscribeToken('parent@example.com', 'forged')).toBe(false);
    });

    it('is case-insensitive on the address', () => {
      const url = service.buildUnsubscribeUrl('Parent@Example.com');
      const token = new URL(url).searchParams.get('token') as string;
      expect(service.verifyUnsubscribeToken('parent@example.com', token)).toBe(true);
    });
  });

  describe('activation emails', () => {
    const data = {
      recipientEmail: 'admin@club.example',
      firstName: 'Sam',
      clubName: 'Whitby Seals',
    };

    it('sends the day 2 schedule-sessions email', async () => {
      await service.sendActivationScheduleSessions(data);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@club.example',
          subject: "Put this week's sessions in Swimly",
        }),
      );
    });

    it('sends the day 5 first-register email', async () => {
      await service.sendActivationFirstRegister(data);
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@club.example',
          subject: 'Take your first register poolside',
        }),
      );
    });

    it('sends the day 10 check-in as plain text with the configured reply-to', async () => {
      await service.sendActivationCheckIn(data);
      const call = sendMock.mock.calls[0][0];
      expect(call.subject).toBe('What stopped you?');
      expect(call.text).toContain('Hi Sam');
      expect(call.text).toContain('Whitby Seals');
      expect(call.html).toBeUndefined();
      expect(call.replyTo).toBe('owner@example.com');
    });
  });

  describe('suppression', () => {
    const buildWithSuppressions = async (suppressed: boolean) => {
      const { getRepositoryToken } = jest.requireActual('@nestjs/typeorm');
      const { EmailSuppression } = jest.requireActual('./entities/email-suppression.entity');
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          EmailService,
          { provide: ConfigService, useValue: mockConfigService },
          {
            provide: getRepositoryToken(EmailSuppression),
            useValue: {
              findOne: jest
                .fn()
                .mockResolvedValue(suppressed ? { email: 'admin@club.example' } : null),
              save: jest.fn(),
            },
          },
        ],
      }).compile();
      return module.get<EmailService>(EmailService);
    };

    it('skips marketing sends to suppressed addresses', async () => {
      const suppressingService = await buildWithSuppressions(true);
      sendMock.mockClear();

      await suppressingService.sendActivationScheduleSessions({
        recipientEmail: 'admin@club.example',
        firstName: 'Sam',
        clubName: 'Whitby Seals',
      });

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('still sends transactional email to suppressed addresses', async () => {
      const suppressingService = await buildWithSuppressions(true);
      sendMock.mockClear();

      await suppressingService.sendWelcome({
        firstName: 'Sam',
        lastName: 'Seal',
        email: 'admin@club.example',
        recipientEmail: 'admin@club.example',
        role: 'super_admin',
        loginUrl: 'https://app.test.com/login',
      });

      expect(sendMock).toHaveBeenCalled();
    });

    it('sends marketing email when the address is not suppressed', async () => {
      const cleanService = await buildWithSuppressions(false);
      sendMock.mockClear();

      await cleanService.sendActivationScheduleSessions({
        recipientEmail: 'admin@club.example',
        firstName: 'Sam',
        clubName: 'Whitby Seals',
      });

      expect(sendMock).toHaveBeenCalled();
    });
  });
});
