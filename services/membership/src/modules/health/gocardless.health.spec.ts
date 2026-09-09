import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';
import { GoCardlessHealthIndicator } from './gocardless.health';

describe('GoCardlessHealthIndicator', () => {
  let indicator: GoCardlessHealthIndicator;
  let config: Record<string, string | undefined>;

  const buildIndicator = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoCardlessHealthIndicator,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => config[key] ?? defaultValue),
          },
        },
      ],
    }).compile();

    return module.get<GoCardlessHealthIndicator>(GoCardlessHealthIndicator);
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports environment and webhook secret presence when not configured', async () => {
    config = {};
    indicator = await buildIndicator();

    const result = await indicator.isHealthy('gocardless');

    expect(result.gocardless).toEqual({
      status: 'up',
      notConfigured: true,
      environment: 'sandbox',
      webhookSecretConfigured: false,
    });
  });

  it('makes a live environment with a missing webhook secret loudly visible', async () => {
    config = {
      GOCARDLESS_ACCESS_TOKEN: 'live_token',
      GOCARDLESS_ENVIRONMENT: 'live',
    };
    indicator = await buildIndicator();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await indicator.isHealthy('gocardless');

    expect(result.gocardless).toMatchObject({
      status: 'up',
      environment: 'live',
      webhookSecretConfigured: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.gocardless.com/customers?limit=1',
      expect.anything(),
    );
  });

  it('includes the config facts on a failed check', async () => {
    config = {
      GOCARDLESS_ACCESS_TOKEN: 'sandbox_token',
      GOCARDLESS_WEBHOOK_SECRET: 'secret',
    };
    indicator = await buildIndicator();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    await expect(indicator.isHealthy('gocardless')).rejects.toThrow(HealthCheckError);

    try {
      await indicator.isHealthy('gocardless');
    } catch (error) {
      expect((error as HealthCheckError).causes).toEqual({
        gocardless: {
          status: 'down',
          statusCode: 401,
          environment: 'sandbox',
          webhookSecretConfigured: true,
        },
      });
    }
  });

  it('never includes token or secret values in the result', async () => {
    config = {
      GOCARDLESS_ACCESS_TOKEN: 'super_secret_token',
      GOCARDLESS_ENVIRONMENT: 'live',
      GOCARDLESS_WEBHOOK_SECRET: 'super_secret_webhook',
    };
    indicator = await buildIndicator();
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const result = await indicator.isHealthy('gocardless');

    expect(JSON.stringify(result)).not.toContain('super_secret');
  });
});
