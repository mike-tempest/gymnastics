import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClubsService } from './clubs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentConnectionsService } from '../finance/payment-connections/payment-connections.service';

/**
 * Shape returned by GET /clubs/me: the caller's club identity plus its
 * regional configuration. Deliberately excludes internal fields (status,
 * affiliate numbers, timestamps).
 */
export interface ClubMeResponse {
  id: string;
  name: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  governing_body: string | null;
  governing_body_region: string | null;
  /** Customer-facing name of the club's tax (VAT, GST, Sales tax) or null. */
  tax_label: string | null;
  /** True when the club's prices already include tax (AU GST convention). */
  tax_inclusive: boolean;
  /** Tax registration identifier (ABN, VAT number, GST/HST number) or null. */
  tax_registration_number: string | null;
  /**
   * The payment provider the club currently transacts on: its active
   * connection's provider, 'gocardless' for legacy clubs still on Swimly's
   * environment credentials, or null when the club cannot collect at all.
   */
  payment_provider: 'stripe' | 'gocardless' | null;
}

@Controller('clubs')
@UseGuards(JwtAuthGuard)
export class ClubsController {
  constructor(
    private readonly clubsService: ClubsService,
    private readonly paymentConnections: PaymentConnectionsService,
  ) {}

  /**
   * Returns the calling user's own club with its regional settings.
   *
   * Guarded by JwtAuthGuard only, with no role restriction: every
   * authenticated role (including parents) needs the club's timezone, locale,
   * and currency to render dates and amounts correctly, and parent-portal
   * pages will consume this endpoint. The club is resolved from the CLS
   * tenant context (set from the JWT's club_id), never from client input.
   */
  @Get('me')
  async getMyClub(): Promise<ClubMeResponse> {
    const club = await this.clubsService.findCurrent();
    return {
      id: club.id,
      name: club.name,
      country: club.country,
      currency: club.currency,
      timezone: club.timezone,
      locale: club.locale,
      governing_body: club.governing_body ?? null,
      governing_body_region: club.governing_body_region ?? null,
      // Tax presentation fields: the invoice pages need these to render tax
      // invoices (heading, ABN line, inclusive breakdown) for every role,
      // parents included. Nullable and default-false, so GB clubs that have
      // not configured tax see no change.
      tax_label: club.tax_label ?? null,
      tax_inclusive: club.tax_inclusive === true,
      tax_registration_number: club.tax_registration_number ?? null,
      // Which provider the club transacts on, so the web app can label the
      // payment-setup flow (Stripe Checkout vs GoCardless redirect) correctly
      // for every role, parents included.
      payment_provider: await this.paymentConnections.providerForClub(club.id),
    };
  }
}
