import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { GoCardlessHealthIndicator } from './gocardless.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [GoCardlessHealthIndicator],
})
export class HealthModule {}
