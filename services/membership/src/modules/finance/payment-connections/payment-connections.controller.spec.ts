import { Test, TestingModule } from '@nestjs/testing';
import { PaymentConnectionsController } from './payment-connections.controller';
import { StripeConnectService } from './stripe-connect.service';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

describe('PaymentConnectionsController', () => {
  const CLUB_ID = 'club-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let controller: PaymentConnectionsController;

  const mockStripeConnect = {
    startOnboarding: jest.fn(),
    syncForClub: jest.fn(),
    getStatusForClub: jest.fn(),
  };

  const mockTenantContext = {
    getClubId: jest.fn().mockReturnValue(CLUB_ID),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentConnectionsController],
      providers: [
        { provide: StripeConnectService, useValue: mockStripeConnect },
        { provide: TenantContextService, useValue: mockTenantContext },
      ],
    }).compile();

    controller = module.get(PaymentConnectionsController);
    jest.clearAllMocks();
    mockTenantContext.getClubId.mockReturnValue(CLUB_ID);
  });

  it('starts onboarding for the CALLER club, never a client-supplied one', async () => {
    mockStripeConnect.startOnboarding.mockResolvedValue({ url: 'https://connect.stripe.com/x' });

    await expect(controller.connectStripe()).resolves.toEqual({
      url: 'https://connect.stripe.com/x',
    });
    expect(mockStripeConnect.startOnboarding).toHaveBeenCalledWith(CLUB_ID);
  });

  it('syncs the caller club', async () => {
    const payload = { configured: true, provider: 'stripe', status: 'active' };
    mockStripeConnect.syncForClub.mockResolvedValue(payload);

    await expect(controller.syncStripe()).resolves.toBe(payload);
    expect(mockStripeConnect.syncForClub).toHaveBeenCalledWith(CLUB_ID);
  });

  it('reports the caller club connection status', async () => {
    const payload = { configured: false, provider: null, status: 'none' };
    mockStripeConnect.getStatusForClub.mockResolvedValue(payload);

    await expect(controller.getConnection()).resolves.toBe(payload);
    expect(mockStripeConnect.getStatusForClub).toHaveBeenCalledWith(CLUB_ID);
  });
});
