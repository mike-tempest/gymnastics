import { ConfigService } from '@nestjs/config';

export const getGoCardlessConfig = (configService: ConfigService) => ({
  accessToken: configService.get<string>('GOCARDLESS_ACCESS_TOKEN'),
  environment: configService.get<string>('GOCARDLESS_ENVIRONMENT', 'sandbox'),
  webhookSecret: configService.get<string>('GOCARDLESS_WEBHOOK_SECRET'),
});

export type GoCardlessConfig = ReturnType<typeof getGoCardlessConfig>;
