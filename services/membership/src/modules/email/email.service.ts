import { createHmac, timingSafeEqual } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as Handlebars from 'handlebars';
import { Resend } from 'resend';
import { Repository } from 'typeorm';
import { WaitlistEntry } from '../waitlist/entities/waitlist.entity';
import { EmailSuppression } from './entities/email-suppression.entity';

// Send via Resend's HTTPS API rather than SMTP because Railway blocks
// outbound SMTP on every port. The single shared RESEND_API_KEY drives the
// connection; if missing, every send method silently no-ops and logs a
// warning so local dev and unconfigured environments stay quiet.

export interface InvoiceCreatedEmailData {
  familyName: string;
  recipientEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  // Tax breakdown, only present when the club applies a tax rate. When absent
  // the template shows a single Total row exactly as before.
  subtotal?: string;
  taxLabel?: string;
  taxAmount?: string;
  // True when the club's prices already include the tax (the Australian GST
  // convention): the template renders an "Includes GST" row rather than an
  // added-on-top Subtotal/tax breakdown.
  taxInclusive?: boolean;
  // Tax invoice fields, only present when tax was applied AND the club has a
  // tax registration number on file. isTaxInvoice switches the title to
  // "Tax Invoice" and the label/number pair renders the ABN (AU), VAT number
  // (GB) or GST/HST number (CA) line. Absent for GB clubs without a
  // registration number, whose emails are unchanged.
  isTaxInvoice?: boolean;
  taxRegistrationLabel?: string;
  taxRegistrationNumber?: string;
  items: Array<{
    description: string;
    amount: string;
  }>;
  viewInvoiceUrl?: string;
}

export interface PaymentConfirmedEmailData {
  familyName: string;
  recipientEmail: string;
  paymentAmount: string;
  paymentDate: string;
  paymentMethod: string;
  invoiceNumber: string;
  referenceNumber?: string;
}

export interface PaymentFailedEmailData {
  familyName: string;
  recipientEmail: string;
  paymentAmount: string;
  invoiceNumber: string;
  failureReason?: string;
  /**
   * True when failureReason carries a specific cause from the provider rather
   * than the generic fallback. Gates the template's "common causes" list,
   * which only renders when the actual cause is unknown.
   */
  hasSpecificFailureReason?: boolean;
  retryDate?: string;
}

export interface MandateSetupRequiredEmailData {
  familyName: string;
  recipientEmail: string;
  setupUrl: string;
  clubName: string;
  /**
   * The club's bank-debit scheme (see REGION_CONFIG directDebitScheme).
   * 'becs' switches the protection copy to the Australian Direct Debit
   * Request Service Agreement wording. Absent or any other value renders the
   * original GB Direct Debit Guarantee copy unchanged.
   */
  directDebitScheme?: string;
}

export interface MandateConfirmedEmailData {
  familyName: string;
  recipientEmail: string;
  mandateReference: string;
  setupDate: string;
  /** See MandateSetupRequiredEmailData.directDebitScheme. */
  directDebitScheme?: string;
}

export interface WelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  recipientEmail: string;
  role: string;
  loginUrl: string;
  supportUrl?: string;
}

export interface DBSExpiryWarningEmailData {
  firstName: string;
  lastName: string;
  recipientEmail: string;
  certificateNumber: string;
  /**
   * Label for the certificate/card/reference number row. Defaults to the
   * previous GB "Certificate Number" so existing UK emails are unchanged.
   */
  certificateNumberLabel?: string;
  checkType: string;
  issueDate: string;
  expiryDate: string;
  daysUntilExpiry: number;
  renewalUrl?: string;
  contactNumber?: string;
  clubDomain?: string;
  supportUrl?: string;
  /**
   * Short name of the background-check framework (e.g. "DBS" for Swim England,
   * "SafeSport" for USA Swimming). Drives the subject line and body wording.
   * Defaults to "DBS" so existing GB clubs are unchanged.
   */
  frameworkName?: string;
  /**
   * Safeguarding framework wording for the consequences paragraph (e.g. "Swim
   * England Wavepower 2024"). Defaults to the Swim England value for GB clubs.
   */
  safeguardingFramework?: string;
  /**
   * Whether to render the GB-only DBS Update Service renewal instructions. Only
   * Swim England (and other DBS-framework bodies) use the Update Service.
   */
  showUpdateService?: boolean;
}

export interface ConsentExpiryWarningEmailData {
  parentName: string;
  recipientEmail: string;
  swimmerName: string;
  swimmerDOB: string;
  squadName: string;
  expiringCount: number;
  multipleExpiring: boolean;
  nearestExpiry?: string;
  expiringConsents: Array<{
    name: string;
    icon: string;
    expiryDate: string;
  }>;
  /**
   * Sentence fragment naming the privacy law and safeguarding framework the
   * club must remain compliant with, resolved from its governing body (e.g.
   * "GDPR and Swim England Wavepower requirements").
   */
  complianceRequirements: string;
  consentUrl: string;
}

export interface BroadcastEmailData {
  recipientEmail: string;
  subject: string;
  body: string;
  clubName: string;
}

export interface SessionCancelledEmailData {
  recipientEmail: string;
  memberName: string;
  sessionName: string;
  sessionDate: string;
  sessionTime: string;
  squadName: string;
  location?: string;
  reason?: string;
}

export interface SessionReminderEmailData {
  parentName: string;
  recipientEmail: string;
  swimmerName?: string;
  multipleSwimmers: boolean;
  sessionType: string;
  sessionTime: string;
  sessionDate: string;
  fullDateTime: string;
  timeUntilSession: string;
  squadName: string;
  poolName: string;
  poolAddress: string;
  duration: string;
  coachName?: string;
  swimmers?: Array<{
    name: string;
    lane?: string;
  }>;
  additionalEquipment?: string;
  poolMapUrl?: string;
  poolParkingInfo?: string;
  sessionNotes?: string;
  viewSessionUrl: string;
}

export interface NewClubSignupAlertData {
  newClubName: string;
  slug: string;
  clubId: string;
  region?: string;
  county?: string;
  affiliateNumber?: string;
  clubContactEmail?: string;
  adminName: string;
  adminEmail: string;
  signedUpAt: string;
}

export interface ActivationEmailData {
  recipientEmail: string;
  firstName?: string;
  clubName: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly clubName: string;
  private readonly appUrl: string;
  private readonly alertEmail: string;
  private readonly templatesDir: string;
  private readonly templateCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor(
    private readonly configService: ConfigService,
    // Optional so specs and contexts without the entity registered still
    // construct; without it, suppression checks are skipped.
    @Optional()
    @InjectRepository(EmailSuppression)
    private readonly suppressions?: Repository<EmailSuppression>,
  ) {
    const apiKey =
      this.configService.get<string>('RESEND_API_KEY') ||
      this.configService.get<string>('EMAIL_PASSWORD');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from = this.configService.get<string>('EMAIL_FROM', 'Swimly <hello@updates.swimly.uk>');
    this.clubName = this.configService.get<string>('CLUB_NAME', 'Your Swimming Club');
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    // Internal recipient for platform alerts (e.g. new club signups).
    this.alertEmail = this.configService.get<string>('SIGNUP_ALERT_EMAIL', 'mike@swimly.uk');
    // Templates ship next to this file under dist/modules/email/templates,
    // copied at build time via nest-cli.json assets.
    this.templatesDir = join(__dirname, 'templates');
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not configured; email sends will no-op');
    }
  }

  /**
   * HMAC over the lowercased address, so unsubscribe links cannot be forged
   * to suppress arbitrary addresses. Falls back to JWT_SECRET so no new env
   * var is strictly required.
   */
  private unsubscribeToken(email: string): string {
    const secret =
      this.configService.get<string>('UNSUBSCRIBE_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'swimly-unsubscribe-dev';
    return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
  }

  verifyUnsubscribeToken(email: string, token: string): boolean {
    const expected = Buffer.from(this.unsubscribeToken(email), 'utf8');
    const provided = Buffer.from(String(token ?? ''), 'utf8');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  buildUnsubscribeUrl(email: string): string {
    return `${this.appUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${this.unsubscribeToken(email)}`;
  }

  async isSuppressed(email: string): Promise<boolean> {
    if (!this.suppressions) {
      return false;
    }
    const row = await this.suppressions.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    return Boolean(row);
  }

  async suppress(email: string, reason: string = 'unsubscribed'): Promise<void> {
    if (!this.suppressions) {
      this.logger.warn('Suppression store not available; unsubscribe not persisted');
      return;
    }
    await this.suppressions.save({ email: email.trim().toLowerCase(), reason });
  }

  private render(name: string, context: Record<string, unknown>): string {
    let compiled = this.templateCache.get(name);
    if (!compiled) {
      const source = readFileSync(join(this.templatesDir, `${name}.hbs`), 'utf8');
      compiled = Handlebars.compile(source);
      this.templateCache.set(name, compiled);
    }
    return compiled({
      ...context,
      clubName: this.clubName,
      appUrl: this.appUrl,
      year: new Date().getFullYear(),
    });
  }

  private async send(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    options?: { marketing?: boolean; replyTo?: string; text?: string },
  ): Promise<void> {
    this.logger.log(`Sending ${template} email to ${to}`);
    // Marketing and nurture email respects the suppression list; transactional
    // email (invoices, payment status, reminders) does not pass marketing.
    if (options?.marketing && (await this.isSuppressed(to))) {
      this.logger.log(`Skipping ${template} send to ${to}: address is unsubscribed`);
      return;
    }
    if (!this.resend) {
      this.logger.warn(`Skipping ${template} send to ${to}: Resend not configured`);
      return;
    }
    try {
      const payload = options?.text
        ? { from: this.from, to, subject, text: options.text }
        : { from: this.from, to, subject, html: this.render(template, context) };
      const result = await this.resend.emails.send({
        ...payload,
        ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
      } as Parameters<Resend['emails']['send']>[0]);
      if (result.error) {
        throw new Error(`${result.error.name}: ${result.error.message}`);
      }
      this.logger.log(
        `${template} email sent to ${to} (resend id: ${result.data?.id ?? 'unknown'})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${template} email to ${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async sendInvoiceCreated(data: InvoiceCreatedEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `New Invoice #${data.invoiceNumber} from ${this.clubName}`,
      'invoice-created',
      data as unknown as Record<string, unknown>,
    );
  }

  async sendPaymentConfirmed(data: PaymentConfirmedEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Payment Confirmed - ${this.clubName}`,
      'payment-confirmed',
      data as unknown as Record<string, unknown>,
    );
  }

  async sendPaymentFailed(data: PaymentFailedEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Payment Failed - Action Required - ${this.clubName}`,
      'payment-failed',
      data as unknown as Record<string, unknown>,
    );
  }

  async sendMandateSetupRequired(data: MandateSetupRequiredEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Set Up Direct Debit for ${this.clubName}`,
      'mandate-setup-required',
      {
        ...data,
        clubName: data.clubName || this.clubName,
        isBecs: data.directDebitScheme === 'becs',
      },
    );
  }

  async sendMandateConfirmed(data: MandateConfirmedEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Direct Debit Setup Complete - ${this.clubName}`,
      'mandate-confirmed',
      { ...data, isBecs: data.directDebitScheme === 'becs' },
    );
  }

  async sendWelcome(data: WelcomeEmailData): Promise<void> {
    await this.send(data.recipientEmail, `Welcome to ${this.clubName}!`, 'welcome', {
      ...data,
      supportUrl: data.supportUrl || `${this.appUrl}/support`,
    });
  }

  async sendDBSExpiryWarning(data: DBSExpiryWarningEmailData): Promise<void> {
    // GB clubs pass "DBS" so the subject stays byte-identical.
    const frameworkName = data.frameworkName || 'DBS';
    await this.send(
      data.recipientEmail,
      `${frameworkName} Check Expiring in ${data.daysUntilExpiry} Days - Action Required`,
      'dbs-expiry-warning',
      {
        ...data,
        frameworkName,
        certificateNumberLabel: data.certificateNumberLabel || 'Certificate Number',
        clubDomain: data.clubDomain || 'swimclub.co.uk',
        renewalUrl: data.renewalUrl || `${this.appUrl}/compliance/dbs/renew`,
        supportUrl: data.supportUrl || `${this.appUrl}/support`,
      },
    );
  }

  async sendConsentExpiryWarning(data: ConsentExpiryWarningEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Consent Renewal Required for ${data.swimmerName} - ${this.clubName}`,
      'consent-expiry-warning',
      data as unknown as Record<string, unknown>,
    );
  }

  async sendSessionReminder(data: SessionReminderEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Session Reminder: ${data.sessionType} - ${data.sessionTime}`,
      'session-reminder',
      data as unknown as Record<string, unknown>,
    );
  }

  async sendWaitlistConfirmation(entry: WaitlistEntry): Promise<void> {
    await this.send(
      entry.email,
      "You're on the Swimly waitlist!",
      'waitlist-confirmation',
      {
        name: entry.name,
        clubName: entry.clubName,
        unsubscribeUrl: this.buildUnsubscribeUrl(entry.email),
      },
      { marketing: true },
    );
  }

  async sendWaitlistDrip1(entry: WaitlistEntry): Promise<void> {
    await this.send(
      entry.email,
      "The problem we're solving at Swimly",
      'waitlist-drip-1',
      {
        name: entry.name,
        unsubscribeUrl: this.buildUnsubscribeUrl(entry.email),
      },
      { marketing: true },
    );
  }

  async sendWaitlistDrip2(entry: WaitlistEntry): Promise<void> {
    await this.send(
      entry.email,
      'What Swimly will do for your club',
      'waitlist-drip-2',
      {
        name: entry.name,
        unsubscribeUrl: this.buildUnsubscribeUrl(entry.email),
      },
      { marketing: true },
    );
  }

  async sendBroadcast(data: BroadcastEmailData): Promise<void> {
    // Split the raw text body into paragraphs for the template. Handlebars
    // will HTML-escape each paragraph automatically.
    const bodyParagraphs = data.body
      .split(/\n{2,}|\r\n\r\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    await this.send(data.recipientEmail, `${data.clubName}: ${data.subject}`, 'broadcast', {
      subject: data.subject,
      clubName: data.clubName,
      bodyParagraphs,
    });
  }

  async sendSessionCancelled(data: SessionCancelledEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      `Session Cancelled: ${data.sessionName} on ${data.sessionDate}`,
      'session-cancelled',
      data as unknown as Record<string, unknown>,
    );
  }

  async sendWaitlistDrip3(entry: WaitlistEntry): Promise<void> {
    await this.send(
      entry.email,
      'Founding clubs get a say',
      'waitlist-drip-3',
      {
        name: entry.name,
        unsubscribeUrl: this.buildUnsubscribeUrl(entry.email),
      },
      { marketing: true },
    );
  }

  /**
   * Activation sequence, day 2: nudge the club to put this week's sessions
   * in. Scheduling sessions is the behaviour that predicts activation.
   */
  async sendActivationScheduleSessions(data: ActivationEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      "Put this week's sessions in Swimly",
      'activation-schedule-sessions',
      {
        firstName: data.firstName,
        activationClubName: data.clubName,
        sessionsUrl: `${this.appUrl}/sessions`,
        unsubscribeUrl: this.buildUnsubscribeUrl(data.recipientEmail),
      },
      { marketing: true },
    );
  }

  /**
   * Activation sequence, day 5: take the first register poolside.
   */
  async sendActivationFirstRegister(data: ActivationEmailData): Promise<void> {
    await this.send(
      data.recipientEmail,
      'Take your first register poolside',
      'activation-first-register',
      {
        firstName: data.firstName,
        activationClubName: data.clubName,
        sessionsUrl: `${this.appUrl}/sessions`,
        unsubscribeUrl: this.buildUnsubscribeUrl(data.recipientEmail),
      },
      { marketing: true },
    );
  }

  /**
   * Activation sequence, day 10: a plain-text personal note asking what
   * stopped them, with replies going straight to Mike.
   */
  async sendActivationCheckIn(data: ActivationEmailData): Promise<void> {
    const firstName = data.firstName?.trim() || 'there';
    const text = [
      `Hi ${firstName},`,
      '',
      `You set up ${data.clubName} on Swimly about ten days ago, and it looks like it has not quite clicked yet.`,
      '',
      'That is useful for me to know. If something got in the way, a missing feature, something confusing, or just no time, hit reply and tell me. I read and answer every one of these myself.',
      '',
      'And if now is simply not the moment, that is fine too. Your club and data will be here when you are ready.',
      '',
      'Thanks,',
      'Mike',
      'Founder, Swimly',
      '',
      `Prefer not to hear from me? Unsubscribe: ${this.buildUnsubscribeUrl(data.recipientEmail)}`,
    ].join('\n');

    await this.send(
      data.recipientEmail,
      'What stopped you?',
      'activation-check-in',
      {},
      {
        marketing: true,
        text,
        replyTo: this.configService.get<string>('ACTIVATION_REPLY_TO', 'mike@swimly.uk'),
      },
    );
  }

  /**
   * Internal alert to the Swimly team when a new club self-serve signs up.
   * Sent to SIGNUP_ALERT_EMAIL (default mike@swimly.uk), not to the club.
   */
  async sendNewClubSignupAlert(data: NewClubSignupAlertData): Promise<void> {
    await this.send(
      this.alertEmail,
      `New club signed up: ${data.newClubName}`,
      'new-club-signup',
      data as unknown as Record<string, unknown>,
    );
  }
}
