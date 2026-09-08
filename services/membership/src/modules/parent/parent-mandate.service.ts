import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MandatesService } from '../finance/mandates/mandates.service';
import { DirectDebitMandate } from '../finance/mandates/entities/direct-debit-mandate.entity';

/** How long a parent has to finish a mandate setup once they start it. */
const SETUP_TOKEN_TTL_MS = 60 * 60 * 1000;

const TOKEN_VERSION = 'v1';

/**
 * Direct Debit setup for the parent who is actually paying (TEM-22).
 *
 * The admin routes on MandatesController take a family_id in the body and are
 * SUPER_ADMIN only, which means a parent has never been able to start their
 * own mandate. These two calls close that gap without touching those routes:
 * the family comes from the caller's JWT, never from the request body, so a
 * parent can only ever set up a mandate for their own family.
 *
 * The session token is minted here rather than in the browser. GoCardless
 * requires the same token on both halves of a redirect flow, and the previous
 * pattern generated it client-side and kept it in sessionStorage, which meant
 * the server accepted whatever came back. This version signs the family id
 * and an expiry with an HMAC, so completing a flow proves the same family
 * started it, and proves it recently.
 */
@Injectable()
export class ParentMandateService {
  private readonly logger = new Logger(ParentMandateService.name);

  constructor(
    private readonly mandatesService: MandatesService,
    private readonly configService: ConfigService,
  ) {}

  async startSetup(
    familyId: string,
    successRedirectUrl: string,
  ): Promise<{ redirect_flow_id: string; redirect_url: string; session_token: string }> {
    const sessionToken = this.mintToken(familyId);
    return await this.mandatesService.createRedirectFlow(
      familyId,
      sessionToken,
      successRedirectUrl,
    );
  }

  async completeSetup(
    familyId: string,
    redirectFlowId: string,
    sessionToken: string,
  ): Promise<DirectDebitMandate> {
    if (!redirectFlowId) {
      throw new BadRequestException('The Direct Debit setup is missing its reference');
    }
    if (!this.verifyToken(familyId, sessionToken)) {
      this.logger.warn(
        `Rejected a mandate completion for family ${familyId}: the setup token did not verify`,
      );
      throw new BadRequestException(
        'This Direct Debit setup has expired or does not belong to you. Please start again.',
      );
    }
    return await this.mandatesService.completeRedirectFlow(redirectFlowId, sessionToken, familyId);
  }

  /**
   * `v1.<expiry ms>.<nonce>.<signature>`. The family id is signed but not
   * carried, because the caller's JWT already says which family it is: the
   * token only has to prove that this family started this flow.
   */
  private mintToken(familyId: string): string {
    const expiresAt = Date.now() + SETUP_TOKEN_TTL_MS;
    const nonce = randomBytes(8).toString('hex');
    const signature = this.sign(familyId, expiresAt, nonce);
    return `${TOKEN_VERSION}.${expiresAt}.${nonce}.${signature}`;
  }

  private verifyToken(familyId: string, token: string): boolean {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
      return false;
    }
    const [, expiryPart, nonce, signature] = parts;
    const expiresAt = Number(expiryPart);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return false;
    }
    const expected = Buffer.from(this.sign(familyId, expiresAt, nonce), 'utf8');
    const provided = Buffer.from(signature, 'utf8');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  private sign(familyId: string, expiresAt: number, nonce: string): string {
    // Falls back to JWT_SECRET so no new environment variable is required,
    // matching how the unsubscribe links are signed.
    const secret =
      this.configService.get<string>('MANDATE_SETUP_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'mandate-setup-dev';
    return createHmac('sha256', secret)
      .update(`${familyId}|${expiresAt}|${nonce}`)
      .digest('base64url');
  }
}
