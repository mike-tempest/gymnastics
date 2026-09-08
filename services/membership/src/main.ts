// Must stay first: loads .env files before module decorators read flags.
import './config/env.preload';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AppModule } from './app.module';
import { API_KEY_HEADER } from './modules/api-keys/guards/api-key.guard';
import { apiKeyPrefixOf } from './modules/api-keys/api-key-crypto';
import { OPENAPI_DOCS_PATH } from './modules/api-keys/openapi.constants';
import { setupOpenApi } from './modules/api-keys/openapi';

async function bootstrap() {
  // rawBody: true retains the exact request bytes as `req.rawBody`. Webhook
  // signature verification (Stripe and GoCardless) recomputes an HMAC over the
  // raw body, so it MUST see the original bytes: a re-serialised `req.body`
  // reorders keys and changes whitespace and would never match the signature.
  // Purely additive; every other endpoint keeps using the parsed `req.body`.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Trust proxy when behind Railway/reverse proxy
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Security headers via Helmet
  app.use(helmet());

  // Enable CORS - Parse comma-separated origins from environment
  const corsOrigins = configService
    .get('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((origin: string) => origin.trim());

  app.enableCors({
    origin: isProduction ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    maxAge: isProduction ? 86400 : undefined,
  });

  // Rate limiting on auth endpoints (login, register, profile).
  //
  // The defaults are the production values and should not be raised there. The
  // window and cap are configurable because the limit is low enough to block
  // legitimate local work: the e2e suite makes more than 15 requests to
  // /api/auth in one run, so every run after the first fifteen returns 429.
  // Set AUTH_RATE_LIMIT_MAX higher in a local .env when running that suite.
  //
  // Both values are clamped to at least 1. express-rate-limit reads a max of
  // 0 as "reject everything", so a misread AUTH_RATE_LIMIT_MAX=0 meant as
  // "turn the limit off" would lock every user out of login instead.
  const positiveNumber = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
  };
  const authLimiter = rateLimit({
    windowMs: positiveNumber(configService.get('AUTH_RATE_LIMIT_WINDOW_MS'), 15 * 60 * 1000),
    max: positiveNumber(configService.get('AUTH_RATE_LIMIT_MAX'), 15),
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Too many requests, please try again later' },
  });
  app.use('/api/auth', authLimiter);

  // The waiting list join page is public and unauthenticated, so it gets the
  // same treatment as the auth endpoints. The cap is higher because a busy
  // club's open day genuinely produces a run of sign-ups from one network,
  // and it is configurable for the same reason the auth one is.
  const waitingListJoinLimiter = rateLimit({
    windowMs: positiveNumber(configService.get('JOIN_RATE_LIMIT_WINDOW_MS'), 15 * 60 * 1000),
    max: positiveNumber(configService.get('JOIN_RATE_LIMIT_MAX'), 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Too many requests, please try again later' },
  });
  app.use('/api/waiting-list/join', waitingListJoinLimiter);
  app.use('/api/waiting-list/offers/token', waitingListJoinLimiter);

  // Rate limiting on the club read API, bucketed per key rather than per IP.
  //
  // Same express-rate-limit mechanism and the same configurable-with-safe-
  // defaults shape as the two limiters above, with one difference that
  // matters: the bucket key. Per-IP would be wrong in both directions here.
  // Two clubs whose integrations run from the same cloud region would share
  // a bucket and throttle each other, while one club running from a range of
  // addresses would sidestep the limit entirely. The credential is the
  // identity that should be limited, so that is what it buckets on.
  //
  // Only the non-secret prefix is used, never the secret, so nothing derived
  // from a raw key ends up in the limiter store. A request with no usable key
  // falls back to its IP; those requests are rejected by ApiKeyGuard moments
  // later anyway, and the fallback stops an unauthenticated flood from
  // sharing one bucket.
  const readApiLimiter = rateLimit({
    windowMs: positiveNumber(configService.get('READ_API_RATE_LIMIT_WINDOW_MS'), 60 * 1000),
    max: positiveNumber(configService.get('READ_API_RATE_LIMIT_MAX'), 120),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const prefix = apiKeyPrefixOf(req.header(API_KEY_HEADER));
      return prefix ? `key:${prefix}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
    message: { statusCode: 429, message: 'Too many requests, please try again later' },
  });
  app.use('/api/public', readApiLimiter);

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Set global prefix, excluding health checks so they're accessible at /health
  // and /health/live (outside the /api prefix)
  app.setGlobalPrefix('api', {
    exclude: ['health', 'health/live'],
  });

  // Published documentation for the club read API. Registered after the
  // global prefix so the decorated routes carry their real paths, and
  // restricted to the read surface: see modules/api-keys/openapi.ts.
  setupOpenApi(app);

  const port = configService.get('PORT', 3001);
  await app.listen(port);

  console.log(`\n🚀 Membership Service is running on: http://localhost:${port}/api`);
  console.log(`📖 Club read API docs: http://localhost:${port}/${OPENAPI_DOCS_PATH}`);
  console.log(`📊 Environment: ${configService.get('NODE_ENV', 'development')}\n`);
}

bootstrap();
