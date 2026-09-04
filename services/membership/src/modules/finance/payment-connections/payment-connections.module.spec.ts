import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentConnectionsModule } from './payment-connections.module';
import { PaymentConnectionsService } from './payment-connections.service';
import { StripeConnectService } from './stripe-connect.service';
import { ClubPaymentConnection } from './entities/club-payment-connection.entity';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

/**
 * Stand-ins for the GLOBAL modules (clubs, tenancy) the real application
 * registers once at the root. StripeConnectService and the admin controller
 * resolve these from the global scope in production, so the test provides them
 * the same way rather than importing the real modules and their database.
 */
@Global()
@Module({
  providers: [
    { provide: ClubsRepository, useValue: { findOne: jest.fn() } },
    { provide: TenantContextService, useValue: { getClubId: jest.fn() } },
  ],
  exports: [ClubsRepository, TenantContextService],
})
class TestGlobalsModule {}

/**
 * Compiles the real module, not a hand-assembled copy of its providers.
 *
 * The unit specs mock every collaborator, so they would pass even if the module
 * failed to wire. This checks the module itself resolves and exports what other
 * modules import from it.
 *
 * Scoped to this module deliberately: PaymentProvidersModule reaches through
 * GoCardlessModule into Email and Families, so compiling it needs a real
 * DataSource. There is no sqlite driver and no local Postgres here, so that
 * graph is covered by the deploy's /health check rather than faked into
 * meaninglessness.
 */
describe('PaymentConnectionsModule wiring', () => {
  it('resolves its services from the real module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TestGlobalsModule,
        PaymentConnectionsModule,
      ],
    })
      .overrideProvider(getRepositoryToken(ClubPaymentConnection))
      .useValue({ findOne: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() })
      .compile();

    expect(moduleRef.get(PaymentConnectionsService)).toBeInstanceOf(PaymentConnectionsService);
    expect(moduleRef.get(StripeConnectService)).toBeInstanceOf(StripeConnectService);
  });
});
