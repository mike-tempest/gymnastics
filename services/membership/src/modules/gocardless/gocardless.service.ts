import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoCardlessClient } from 'gocardless-nodejs/client';
import { Environments } from 'gocardless-nodejs/constants';
import {
  PaymentCurrency,
  RedirectFlow,
  RedirectFlowScheme,
  Customer,
  Mandate,
  Payment,
  APIResponse,
  ListMeta,
} from 'gocardless-nodejs/types/Types';
import { createHmac } from 'crypto';
import { getGoCardlessConfig } from '../../config/gocardless.config';
import { GoCardlessWebhookEvent } from './webhooks.service';
import { regionForCountry } from '../../common/region/region.util';

@Injectable()
export class GoCardlessService {
  private readonly logger = new Logger(GoCardlessService.name);
  private client: InstanceType<typeof GoCardlessClient>;
  private config: ReturnType<typeof getGoCardlessConfig>;

  constructor(private configService: ConfigService) {
    this.config = getGoCardlessConfig(configService);

    if (!this.config.accessToken) {
      this.logger.warn('GoCardless access token not configured');
    }

    // Determine environment
    const env = this.config.environment === 'live' ? Environments.Live : Environments.Sandbox;

    // Initialize GoCardless client
    this.client = new GoCardlessClient(this.config.accessToken || '', env);
  }

  isConfigured(): boolean {
    return !!this.config.accessToken;
  }

  /**
   * Create a redirect flow for setting up a Direct Debit mandate
   */
  async createRedirectFlow(params: {
    sessionToken: string;
    successRedirectUrl: string;
    description?: string;
    scheme?: string;
  }): Promise<RedirectFlow & APIResponse> {
    try {
      this.logger.log(`Creating redirect flow for session: ${params.sessionToken}`);

      // Fall back to the default UK payment-method label so an omitted
      // description keeps the exact previous wording for GB clubs.
      const defaultLabel = regionForCountry('GB').paymentMethodLabel;

      const response = await this.client.redirectFlows.create({
        session_token: params.sessionToken,
        success_redirect_url: params.successRedirectUrl,
        description: params.description || `Set up ${defaultLabel} for swim club fees`,
        // Pin the bank-debit scheme when the caller supplies one so GoCardless
        // hosts the correct regional flow. Omitted for callers that do not.
        ...(params.scheme ? { scheme: params.scheme as RedirectFlowScheme } : {}),
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to create redirect flow', error);
      throw new BadRequestException('Failed to create mandate setup flow');
    }
  }

  /**
   * Complete a redirect flow and get the mandate
   */
  async completeRedirectFlow(
    redirectFlowId: string,
    sessionToken: string,
  ): Promise<RedirectFlow & APIResponse> {
    try {
      this.logger.log(`Completing redirect flow: ${redirectFlowId}`);

      const response = await this.client.redirectFlows.complete(redirectFlowId, {
        session_token: sessionToken,
      });

      return response;
    } catch (error) {
      this.logger.error('Failed to complete redirect flow', error);
      throw new BadRequestException('Failed to complete mandate setup');
    }
  }

  /**
   * Get a customer by ID
   */
  async getCustomer(customerId: string): Promise<Customer & APIResponse> {
    try {
      const response = await this.client.customers.find(customerId);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get customer: ${customerId}`, error);
      throw error;
    }
  }

  /**
   * Get a mandate by ID
   */
  async getMandate(mandateId: string): Promise<Mandate & APIResponse> {
    try {
      const response = await this.client.mandates.find(mandateId);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get mandate: ${mandateId}`, error);
      throw error;
    }
  }

  /**
   * Cancel a mandate
   */
  async cancelMandate(mandateId: string): Promise<Mandate & APIResponse> {
    try {
      this.logger.log(`Cancelling mandate: ${mandateId}`);

      const response = await this.client.mandates.cancel(mandateId, {});
      return response;
    } catch (error) {
      this.logger.error(`Failed to cancel mandate: ${mandateId}`, error);
      throw new BadRequestException('Failed to cancel mandate');
    }
  }

  /**
   * Create a payment against a mandate
   */
  async createPayment(params: {
    amount: number;
    currency: string;
    mandateId: string;
    description?: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<Payment & APIResponse> {
    try {
      this.logger.log(
        `Creating payment for mandate: ${params.mandateId}, amount: ${params.amount}`,
      );

      // The idempotency key makes a retry of the same logical charge a no-op:
      // the payment row is written AFTER this call, so a crash in between would
      // otherwise leave money taken with no record and charge the payer twice
      // on retry. The SDK defaults to fetching and returning the original
      // payment on an idempotency conflict rather than raising, which is
      // exactly the wanted behaviour.
      const response = await this.client.payments.create(
        {
          amount: String(Math.round(params.amount * 100)),
          currency: params.currency as PaymentCurrency,
          links: {
            mandate: params.mandateId,
          },
          description: params.description,
          metadata: params.metadata,
        },
        params.idempotencyKey,
      );

      return response;
    } catch (error) {
      this.logger.error('Failed to create payment', error);
      throw new BadRequestException('Failed to create payment');
    }
  }

  /**
   * Get a payment by ID
   */
  async getPayment(paymentId: string): Promise<Payment & APIResponse> {
    try {
      const response = await this.client.payments.find(paymentId);
      return response;
    } catch (error) {
      this.logger.error(`Failed to get payment: ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * List all payments for a mandate
   */
  async listPayments(
    mandateId?: string,
  ): Promise<{ payments: Payment[]; meta: ListMeta } & APIResponse> {
    try {
      const params = mandateId ? { mandate: mandateId } : {};
      const response = await this.client.payments.list(params);
      return response;
    } catch (error) {
      this.logger.error('Failed to list payments', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(requestBody: string, signatureHeader: string): boolean {
    try {
      const computedSignature = createHmac('sha256', this.config.webhookSecret || '')
        .update(requestBody)
        .digest('hex');

      return computedSignature === signatureHeader;
    } catch (error) {
      this.logger.error('Failed to verify webhook signature', error);
      return false;
    }
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(requestBody: { events?: GoCardlessWebhookEvent[] }): GoCardlessWebhookEvent[] {
    return requestBody.events || [];
  }
}
