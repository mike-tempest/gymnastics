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
    // X-API-Key is the club read API credential header. Without it here, a
    // browser-based consumer of that API fails preflight in production and
    // can never send the credential the whole API is built around.
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-API-Key'],
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

  // Rate limiting on the club read API. Two limiters, both needed.
  //
  // The per-key limiter is the one clubs care about, and it buckets on the
  // key prefix rather than the IP because per-IP would be wrong in both
  // directions: two clubs whose integrations run from the same cloud region
  // would throttle each other, while one club running from a range of
  // addresses would sidestep the limit entirely. The credential is the
  // identity that should be limited. Only the non-secret prefix reaches the
  // limiter store, never the secret.
  //
  // On its own, though, that bucket is trivially escaped. The prefix is read
  // before ApiKeyGuard has verified anything, and `apiKeyPrefixOf` only
  // checks the shape of the value, so an attacker sending a fresh random
  // prefix on each request would land in a fresh bucket every time and never
  // meet the cap, while still costing a database lookup apiece. The IP
  // limiter in front closes that: it is bucketed on the address, so it holds
  // whatever the header says. Its cap is the more generous of the two,
  // because a single club legitimately runs several keys from one host and
  // must not be throttled by its own neighbour.
  const readApiIpLimiter = rateLimit({
    windowMs: positiveNumber(configService.get('READ_API_RATE_LIMIT_WINDOW_MS'), 60 * 1000),
    max: positiveNumber(configService.get('READ_API_IP_RATE_LIMIT_MAX'), 600),
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    message: { statusCode: 429, message: 'Too many requests, please try again later' },
  });
  const readApiKeyLimiter = rateLimit({
    windowMs: positiveNumber(configService.get('READ_API_RATE_LIMIT_WINDOW_MS'), 60 * 1000),
    max: positiveNumber(configService.get('READ_API_RATE_LIMIT_MAX'), 120),
    standardHeaders: true,
    legacyHeaders: false,
    // Requests with no usable key share one bucket rather than falling back
    // to the IP: the IP limiter above already covers them, and giving each
    // malformed header its own bucket is exactly the hole being closed.
    keyGenerator: (req) => {
      const prefix = apiKeyPrefixOf(req.header(API_KEY_HEADER));
      return prefix ? `key:${prefix}` : 'key:unauthenticated';
    },
    message: { statusCode: 429, message: 'Too many requests, please try again later' },
  });
  app.use('/api/public', readApiIpLimiter, readApiKeyLimiter);

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
