import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  validateSync,
  IsUrl,
  IsOptional,
  MinLength,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  PORT: number = 3001;

  // Database
  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  // Redis (optional)
  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsNumber()
  @IsOptional()
  REDIS_PORT?: number;

  // JWT - CRITICAL: Must be secure in production
  @IsString()
  @MinLength(32, {
    message:
      "JWT_SECRET must be at least 32 characters long. Generate using: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
  })
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN?: string = '30d';

  // Application URLs
  @IsUrl({ require_tld: false })
  @IsOptional()
  APP_URL?: string = 'http://localhost:3000';

  @IsUrl({ require_tld: false })
  @IsOptional()
  API_URL?: string = 'http://localhost:8000';

  @IsString()
  @IsOptional()
  CLUB_NAME?: string = 'Swimming Club';

  // CORS
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string = 'http://localhost:3000';

  // Email
  @IsString()
  EMAIL_HOST: string;

  @IsNumber()
  EMAIL_PORT: number;

  @IsString()
  @IsOptional()
  EMAIL_USER?: string;

  @IsString()
  @IsOptional()
  EMAIL_PASSWORD?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string = 'SwimNexus UK <noreply@swimnexus.local>';

  @IsString()
  @IsOptional()
  EMAIL_SECURE?: string;

  // GoCardless (optional for dev)
  @IsString()
  @IsOptional()
  GOCARDLESS_ENVIRONMENT?: string = 'sandbox';

  @IsString()
  @IsOptional()
  GOCARDLESS_ACCESS_TOKEN?: string;

  @IsString()
  @IsOptional()
  GOCARDLESS_WEBHOOK_SECRET?: string;

  // Opt-in gate for the legacy GoCardless environment-credentials shim.
  // Exists ONLY for local demo environments that seed GoCardless mandates
  // directly; must never be set in production. Anything other than the exact
  // string 'true' leaves the shim off.
  @IsString()
  @IsOptional()
  LEGACY_GOCARDLESS_ENV_FALLBACK?: string;

  // Swimming times/strokes competitions module gate (TEM-15). The module is
  // feature-flagged off by default and stays in the tree for a possible
  // future gymnastics scoring module. Anything other than the exact string
  // 'true' leaves it off.
  @IsString()
  @IsOptional()
  ENABLE_COMPETITIONS?: string;

  // Stripe Connect (optional; the provider is dormant until the platform key is
  // set, so existing GoCardless clubs are unaffected by its absence).
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  // Logging
  @IsString()
  @IsOptional()
  LOG_LEVEL?: string = 'info';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => {
      return `${error.property}: ${Object.values(error.constraints || {}).join(', ')}`;
    });

    throw new Error(
      `Environment validation failed:\n${errorMessages.join('\n')}\n\n` +
        `Please check your .env file. Copy .env.example and fill in the required values.`,
    );
  }

  return validatedConfig;
}
