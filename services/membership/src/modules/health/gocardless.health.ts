import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoCardlessHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const accessToken = this.configService.get<string>('GOCARDLESS_ACCESS_TOKEN');

    // Cutover-critical facts, surfaced as booleans/enums only, never values:
    // which environment is active and whether webhook signature validation can
    // work. A live cutover with a missing webhook secret or a leftover sandbox
    // setting must be loudly visible here.
    const environment = this.configService.get<string>('GOCARDLESS_ENVIRONMENT', 'sandbox');
    const webhookSecretConfigured = Boolean(
      this.configService.get<string>('GOCARDLESS_WEBHOOK_SECRET'),
    );
    const configFacts = { environment, webhookSecretConfigured };

    if (!accessToken) {
      return { [key]: { status: 'up', notConfigured: true, ...configFacts } };
    }

    const baseUrl =
      environment === 'live' ? 'https://api.gocardless.com' : 'https://api-sandbox.gocardless.com';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      // GoCardless has no public /ping. Hit a real authenticated endpoint with
      // limit=1 so we exercise both reachability and credential validity. A 401
      // would mean the API is up but our token is wrong - we treat that as down
      // because the integration is non-functional from this service's view.
      const response = await fetch(`${baseUrl}/customers?limit=1`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'GoCardless-Version': '2015-07-06',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return { [key]: { status: 'up', statusCode: response.status, ...configFacts } };
      }

      throw new HealthCheckError('GoCardless health check failed', {
        [key]: { status: 'down', statusCode: response.status, ...configFacts },
      });
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      throw new HealthCheckError('GoCardless health check failed', {
        [key]: {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
          ...configFacts,
        },
      });
    }
  }
}
