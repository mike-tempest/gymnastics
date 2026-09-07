// Must stay first: loads .env files before module decorators read flags.
import './config/env.preload';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';

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

  // Rate limiting on auth endpoints (login, register)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // 15 attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { statusCode: 429, message: 'Too many requests, please try again later' },
  });
  app.use('/api/auth', authLimiter);

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

  const port = configService.get('PORT', 3001);
  await app.listen(port);

  console.log(`\n🚀 Membership Service is running on: http://localhost:${port}/api`);
  console.log(`📊 Environment: ${configService.get('NODE_ENV', 'development')}\n`);
}

bootstrap();
