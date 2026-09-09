import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CLUB_PAYMENTS_NOT_SET_UP_MESSAGE, MandatesService } from './mandates.service';
import { MandatesRepository } from './mandates.repository';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import { ProviderNotConnectedException } from '../payment-connections/provider-not-connected.exception';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { ClubsRepository } from '../../clubs/clubs.repository';
import {
  DirectDebitMandate,
  DirectDebitMandateStatus,
} from './entities/direct-debit-mandate.entity';
import { CreateMandateDto } from './dto/create-mandate.dto';
import { UpdateMandateDto } from './dto/update-mandate.dto';

describe('MandatesService', () => {
  let service: MandatesService;
  let _repository: MandatesRepository;

  const mockMandate: Partial<DirectDebitMandate> = {
    mandate_id: '667e8901-e89b-12d3-a456-426614174004',
    family_id: '334e5678-e89b-12d3-a456-426614174002',
    provider_mandate_id: 'MD001ABC',
    status: DirectDebitMandateStatus.ACTIVE,
    scheme: 'bacs',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByFamily: jest.fn(),
    findByStatus: jest.fn(),
    findOne: jest.fn(),
    findActiveByFamily: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  // The provider the registry resolves for a club. MandatesService now talks to
  // this provider-neutral interface instead of GoCardlessService directly.
  const mockProvider = {
    connection: { provider: 'gocardless' },
    isConfigured: jest.fn(),
    startMandateSetup: jest.fn(),
    completeMandateSetup: jest.fn(),
    getMandateStatus: jest.fn(),
    cancelMandate: jest.fn(),
    chargeRecurring: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhookEvents: jest.fn(),
  };

  const mockPaymentProviders = {
    forClub: jest.fn().mockResolvedValue(mockProvider),
  };

  const mockTenantContext = {
    getClubId: jest.fn().mockReturnValue('999e0000-e89b-12d3-a456-426614174099'),
    getClubIdOrNull: jest.fn().mockReturnValue('999e0000-e89b-12d3-a456-426614174099'),
  };

  // Club the tenant context resolves to. Default is a GB club so existing
  // behaviour (Direct Debit wording, 'bacs' scheme) is preserved unless a test
  // overrides the country.
  const mockClubsRepository = {
    findOne: jest.fn().mockResolvedValue({ club_id: '999e0000', country: 'GB' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MandatesService,
        { provide: MandatesRepository, useValue: mockRepository },
        { provide: PaymentProviderRegistry, useValue: mockPaymentProviders },
        { provide: TenantContextService, useValue: mockTenantContext },
        { provide: ClubsRepository, useValue: mockClubsRepository },
      ],
    }).compile();

    service = module.get<MandatesService>(MandatesService);
    _repository = module.get<MandatesRepository>(MandatesRepository);

    // Re-establish provider resolution after clearAllMocks() between tests.
    mockPaymentProviders.forClub.mockResolvedValue(mockProvider);
    mockProvider.connection.provider = 'gocardless';
    mockTenantContext.getClubId.mockReturnValue('999e0000-e89b-12d3-a456-426614174099');
    mockClubsRepository.findOne.mockResolvedValue({ club_id: '999e0000', country: 'GB' });
    // Customer-reuse lookup on the start path: default to no prior mandates.
    mockRepository.findByFamily.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new mandate when no active mandate exists', async () => {
      const createDto = {
        family_id: mockMandate.family_id as string,
        provider_mandate_id: 'MD002XYZ',
        status: DirectDebitMandateStatus.PENDING,
      };

      mockRepository.findActiveByFamily.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({ ...mockMandate, ...createDto });

      const result = await service.create(createDto as CreateMandateDto);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw BadRequestException if the family already has an active mandate', async () => {
      const createDto = {
        family_id: mockMandate.family_id as string,
        provider_mandate_id: 'MD002XYZ',
        status: DirectDebitMandateStatus.ACTIVE,
      };

      mockRepository.findActiveByFamily.mockResolvedValue(mockMandate);

      await expect(service.create(createDto as CreateMandateDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all mandates', async () => {
      mockRepository.findAll.mockResolvedValue([mockMandate]);

      const result = await service.findAll();

      expect(result).toEqual([mockMandate]);
    });
  });

  describe('findByFamily', () => {
    it('should return mandates for a specific family', async () => {
      mockRepository.findByFamily.mockResolvedValue([mockMandate]);

      const result = await service.findByFamily(mockMandate.family_id as string);

      expect(result).toEqual([mockMandate]);
      expect(mockRepository.findByFamily).toHaveBeenCalledWith(mockMandate.family_id);
    });
  });

  describe('findByStatus', () => {
    it('should return mandates with a specific status', async () => {
      mockRepository.findByStatus.mockResolvedValue([mockMandate]);

      const result = await service.findByStatus(DirectDebitMandateStatus.ACTIVE);

      expect(result).toEqual([mockMandate]);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(DirectDebitMandateStatus.ACTIVE);
    });
  });

  describe('findOne', () => {
    it('should return a single mandate', async () => {
      mockRepository.findOne.mockResolvedValue(mockMandate);

      const result = await service.findOne(mockMandate.mandate_id as string);

      expect(result).toEqual(mockMandate);
    });

    it('should throw NotFoundException if mandate does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a mandate', async () => {
      const updateDto = { scheme: 'sepa_core' };
      const updatedMandate = { ...mockMandate, scheme: 'sepa_core' };

      mockRepository.findOne.mockResolvedValue(mockMandate);
      mockRepository.update.mockResolvedValue(updatedMandate);

      const result = await service.update(
        mockMandate.mandate_id as string,
        updateDto as UpdateMandateDto,
      );

      expect(result.scheme).toBe('sepa_core');
    });

    it('should throw NotFoundException if mandate does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { scheme: 'sepa_core' } as UpdateMandateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel an active mandate', async () => {
      const cancelledMandate = { ...mockMandate, status: DirectDebitMandateStatus.CANCELLED };

      mockRepository.findOne
        .mockResolvedValueOnce(mockMandate)
        .mockResolvedValueOnce(cancelledMandate);
      mockProvider.cancelMandate.mockResolvedValue(undefined);
      mockRepository.updateStatus.mockResolvedValue(undefined);

      const result = await service.cancel(mockMandate.mandate_id as string);

      expect(result.status).toBe(DirectDebitMandateStatus.CANCELLED);
      // The GoCardless provider is still cancelled with the same mandate id.
      expect(mockProvider.cancelMandate).toHaveBeenCalledWith(mockMandate.provider_mandate_id);
    });

    it('should throw NotFoundException if mandate does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.cancel('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if mandate is already cancelled', async () => {
      const alreadyCancelled = { ...mockMandate, status: DirectDebitMandateStatus.CANCELLED };
      mockRepository.findOne.mockResolvedValue(alreadyCancelled);

      await expect(service.cancel(mockMandate.mandate_id as string)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should still cancel in the database even if GoCardless cancellation fails', async () => {
      const cancelledMandate = { ...mockMandate, status: DirectDebitMandateStatus.CANCELLED };

      mockRepository.findOne
        .mockResolvedValueOnce(mockMandate)
        .mockResolvedValueOnce(cancelledMandate);
      mockProvider.cancelMandate.mockRejectedValue(new Error('GoCardless API error'));
      mockRepository.updateStatus.mockResolvedValue(undefined);

      const result = await service.cancel(mockMandate.mandate_id as string);

      expect(result.status).toBe(DirectDebitMandateStatus.CANCELLED);
      expect(mockRepository.updateStatus).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a mandate', async () => {
      mockRepository.findOne.mockResolvedValue(mockMandate);
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockMandate.mandate_id as string);

      expect(mockRepository.remove).toHaveBeenCalledWith(mockMandate.mandate_id);
    });

    it('should throw NotFoundException if mandate does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRedirectFlow', () => {
    beforeEach(() => {
      mockRepository.findActiveByFamily.mockResolvedValue(null);
      mockProvider.startMandateSetup.mockResolvedValue({
        flowId: 'RE000001',
        redirectUrl: 'https://pay.gocardless.com/flow',
      });
    });

    it('should keep the exact Direct Debit wording for a GB club', async () => {
      mockClubsRepository.findOne.mockResolvedValue({ club_id: '999e0000', country: 'GB' });

      await service.createRedirectFlow(
        mockMandate.family_id as string,
        'session-123',
        'https://app.swimly.uk/success',
      );

      expect(mockProvider.startMandateSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Set up Direct Debit for swim club membership fees',
          scheme: 'bacs',
        }),
      );
    });

    it('should use the local method label for a US club', async () => {
      mockClubsRepository.findOne.mockResolvedValue({ club_id: '999e0000', country: 'US' });

      await service.createRedirectFlow(
        mockMandate.family_id as string,
        'session-123',
        'https://app.swimly.uk/success',
      );

      expect(mockProvider.startMandateSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Set up ACH bank debit for swim club membership fees',
          scheme: 'ach',
        }),
      );
    });

    it('passes the provider customer id from a previous same-provider mandate', async () => {
      // A cancelled Stripe mandate leaves a durable Stripe customer behind;
      // reusing it stops one family accumulating duplicate customers.
      mockProvider.connection.provider = 'stripe';
      mockRepository.findByFamily.mockResolvedValue([
        {
          provider: 'stripe',
          provider_customer_id: 'cus_previous',
          status: DirectDebitMandateStatus.CANCELLED,
        },
      ]);

      await service.createRedirectFlow(
        mockMandate.family_id as string,
        'session-123',
        'https://app.swimly.uk/success',
      );

      expect(mockProvider.startMandateSetup).toHaveBeenCalledWith(
        expect.objectContaining({ existingProviderCustomerId: 'cus_previous' }),
      );
    });

    it("never reuses another provider's customer id", async () => {
      // The club switched from GoCardless to Stripe: the GoCardless customer id
      // means nothing to Stripe.
      mockProvider.connection.provider = 'stripe';
      mockRepository.findByFamily.mockResolvedValue([
        {
          provider: 'gocardless',
          provider_customer_id: 'CU_GOCARDLESS',
          status: DirectDebitMandateStatus.CANCELLED,
        },
      ]);

      await service.createRedirectFlow(
        mockMandate.family_id as string,
        'session-123',
        'https://app.swimly.uk/success',
      );

      expect(mockProvider.startMandateSetup).toHaveBeenCalledWith(
        expect.objectContaining({ existingProviderCustomerId: undefined }),
      );
    });

    it('surfaces a parent-facing 400 when the club has no payment connection', async () => {
      // With the legacy shim off by default, an unconnected club's provider
      // resolution throws. The parent hitting setup must get copy the frontend
      // can show as-is, not "Connect one in Settings" (they cannot) and never
      // a generic 500.
      mockPaymentProviders.forClub.mockRejectedValue(
        new ProviderNotConnectedException('999e0000-e89b-12d3-a456-426614174099', 'none'),
      );

      await expect(
        service.createRedirectFlow(
          mockMandate.family_id as string,
          'session-123',
          'https://app.swimly.uk/success',
        ),
      ).rejects.toMatchObject(
        // A BadRequestException (400) carrying the exact parent-facing copy.
        expect.objectContaining({ message: CLUB_PAYMENTS_NOT_SET_UP_MESSAGE }),
      );

      await expect(
        service.createRedirectFlow(
          mockMandate.family_id as string,
          'session-123',
          'https://app.swimly.uk/success',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rethrows other provider failures unchanged', async () => {
      const providerError = new Error('GoCardless API error');
      mockProvider.startMandateSetup.mockRejectedValue(providerError);

      await expect(
        service.createRedirectFlow(
          mockMandate.family_id as string,
          'session-123',
          'https://app.swimly.uk/success',
        ),
      ).rejects.toBe(providerError);
    });
  });

  describe('completeRedirectFlow', () => {
    beforeEach(() => {
      mockProvider.completeMandateSetup.mockResolvedValue({
        providerMandateId: 'MD000001',
        providerCustomerId: 'CU000001',
      });
      mockRepository.create.mockImplementation((dto) =>
        Promise.resolve({ ...mockMandate, ...dto }),
      );
    });

    it("should record scheme 'bacs' for a GB club", async () => {
      mockClubsRepository.findOne.mockResolvedValue({ club_id: '999e0000', country: 'GB' });

      await service.completeRedirectFlow(
        'RE000001',
        'session-123',
        mockMandate.family_id as string,
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'bacs' }),
      );
    });

    it("should record scheme 'ach' for a US club", async () => {
      mockClubsRepository.findOne.mockResolvedValue({ club_id: '999e0000', country: 'US' });

      await service.completeRedirectFlow(
        'RE000001',
        'session-123',
        mockMandate.family_id as string,
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'ach' }),
      );
    });

    it("should record scheme 'becs' for an AU club", async () => {
      mockClubsRepository.findOne.mockResolvedValue({ club_id: '999e0000', country: 'AU' });

      await service.completeRedirectFlow(
        'RE000001',
        'session-123',
        mockMandate.family_id as string,
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ scheme: 'becs' }),
      );
    });

    it('stamps the mandate with the provider that captured it', async () => {
      // A Stripe mandate left on the 'gocardless' entity default would be
      // invisible to Stripe webhook routing, which looks up by provider AND id.
      mockProvider.connection.provider = 'stripe';

      await service.completeRedirectFlow('cs_123', 'session-123', mockMandate.family_id as string);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'stripe' }),
      );
    });
  });
});
