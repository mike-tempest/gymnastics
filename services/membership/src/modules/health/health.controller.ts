import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { GoCardlessHealthIndicator } from './gocardless.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private gocardless: GoCardlessHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.gocardless.isHealthy('gocardless'),
    ]);
  }

  // Lightweight liveness probe. Unlike the composite check() above it performs
  // no database or third-party calls, so the web app can poll it cheaply to
  // tell whether the API server itself is reachable. Returns 200 whenever the
  // process is up, regardless of whether downstream dependencies are healthy.
  @Get('live')
  live() {
    return { status: 'ok' };
  }
}
