import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentConnectionsService } from '../payment-connections/payment-connections.service';
import { ProviderNotConnectedException } from '../payment-connections/provider-not-connected.exception';
import {
  PAYMENT_PROVIDER_FACTORIES,
  PaymentProvider,
  PaymentProviderFactory,
  ProviderConnection,
} from './payment-provider.interface';

describe('PaymentProviderRegistry', () => {
  let registry: PaymentProviderRegistry;

  const CLUB_ID = '999e0000-e89b-12d3-a456-426614174099';

  const connection: ProviderConnection = {
    clubId: CLUB_ID,
    provider: 'gocardless',
    externalAccountId: 'OR123',
    livemode: true,
    source: 'connection',
  };

  const mockConnections = {
    requireActiveConnection: jest.fn(),
  };

  // Identity is what the assertions check: forClub must hand back exactly what
  // the factory built, bound to the resolved connection.
  const boundProvider = { connection } as PaymentProvider;

  const goCardlessFactory: PaymentProviderFactory = {
    name: 'gocardless',
    isConfigured: jest.fn().mockReturnValue(true),
    create: jest.fn().mockReturnValue(boundProvider),
  };

  const build = async (factories: PaymentProviderFactory[] = [goCardlessFactory]) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentProviderRegistry,
        { provide: PaymentConnectionsService, useValue: mockConnections },
        { provide: PAYMENT_PROVIDER_FACTORIES, useValue: factories },
      ],
    }).compile();

    return module.get<PaymentProviderRegistry>(PaymentProviderRegistry);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (goCardlessFactory.isConfigured as jest.Mock).mockReturnValue(true);
    (goCardlessFactory.create as jest.Mock).mockReturnValue(boundProvider);
    registry = await build();
  });

  it('should be defined', () => {
    expect(registry).toBeDefined();
  });

  describe('forClub', () => {
    it("returns a provider bound to the club's connection", async () => {
      mockConnections.requireActiveConnection.mockResolvedValue(connection);

      const provider = await registry.forClub(CLUB_ID);

      expect(mockConnections.requireActiveConnection).toHaveBeenCalledWith(CLUB_ID);
      // The factory is handed the resolved connection, not just a club id: the
      // provider must act on that club's own account.
      expect(goCardlessFactory.create).toHaveBeenCalledWith(connection);
      expect(provider).toBe(boundProvider);
    });

    it('propagates ProviderNotConnectedException when the club has no connection', async () => {
      // Swimly is not the merchant of record, so an unconnected club must fail
      // rather than quietly resolve to Swimly's own credentials.
      mockConnections.requireActiveConnection.mockRejectedValue(
        new ProviderNotConnectedException(CLUB_ID, 'none'),
      );

      await expect(registry.forClub(CLUB_ID)).rejects.toThrow(ProviderNotConnectedException);
      expect(goCardlessFactory.create).not.toHaveBeenCalled();
    });

    it('never falls back to another provider when the connected one is unavailable', async () => {
      mockConnections.requireActiveConnection.mockResolvedValue({
        ...connection,
        provider: 'stripe',
      });

      // Only GoCardless is registered. A club connected to Stripe must error,
      // not get silently billed through GoCardless.
      await expect(registry.forClub(CLUB_ID)).rejects.toThrow(ServiceUnavailableException);
      expect(goCardlessFactory.create).not.toHaveBeenCalled();
    });
  });

  describe('bind', () => {
    it('throws when the provider has no registered factory', () => {
      expect(() => registry.bind({ ...connection, provider: 'stripe' })).toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws when the provider is not configured at the platform level', () => {
      // A club can be perfectly connected while the platform itself is
      // misconfigured; that is an operator problem and must not be silent.
      (goCardlessFactory.isConfigured as jest.Mock).mockReturnValue(false);

      expect(() => registry.bind(connection)).toThrow(ServiceUnavailableException);
      expect(goCardlessFactory.create).not.toHaveBeenCalled();
    });

    it('binds the legacy env connection like any other', () => {
      // The env shim is a connection like any other as far as the registry is
      // concerned; only the factory cares where it came from.
      const envConnection: ProviderConnection = { ...connection, source: 'env' };

      const provider = registry.bind(envConnection);

      expect(goCardlessFactory.create).toHaveBeenCalledWith(envConnection);
      expect(provider).toBe(boundProvider);
    });
  });
});
