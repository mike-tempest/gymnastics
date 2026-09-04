import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { MandatesRepository } from './mandates.repository';
import { CreateMandateDto } from './dto/create-mandate.dto';
import { UpdateMandateDto } from './dto/update-mandate.dto';
import {
  DirectDebitMandate,
  DirectDebitMandateStatus,
} from './entities/direct-debit-mandate.entity';
import { PaymentProviderRegistry } from '../payment-providers/payment-provider.registry';
import { ProviderNotConnectedException } from '../payment-connections/provider-not-connected.exception';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';
import { ClubsRepository } from '../../clubs/clubs.repository';
import { regionForCountry } from '../../../common/region/region.util';

/**
 * Parent-facing copy for a mandate-setup attempt against a club with no usable
 * payment connection. ProviderNotConnectedException's own messages tell the
 * CLUB what to do ("Connect one in Settings"), which is meaningless to the
 * parent who actually hits this endpoint, so the setup path swaps in wording
 * the frontend can show as-is. Still a 400: the request is simply not valid
 * until the club connects.
 */
export const CLUB_PAYMENTS_NOT_SET_UP_MESSAGE =
  'This club has not finished setting up online payments yet.';

@Injectable()
export class MandatesService {
  private readonly logger = new Logger(MandatesService.name);

  constructor(
    private readonly mandatesRepository: MandatesRepository,
    private readonly paymentProviders: PaymentProviderRegistry,
    private readonly tenantContext: TenantContextService,
    private readonly clubsRepository: ClubsRepository,
  ) {}

  async create(createMandateDto: CreateMandateDto): Promise<DirectDebitMandate> {
    // Check if family already has an active mandate
    const existingActive = await this.mandatesRepository.findActiveByFamily(
      createMandateDto.family_id,
    );
    if (existingActive) {
      throw new BadRequestException(
        `Family already has an active mandate (ID: ${existingActive.mandate_id})`,
      );
    }

    return await this.mandatesRepository.create(createMandateDto);
  }

  async findAll(): Promise<DirectDebitMandate[]> {
    return await this.mandatesRepository.findAll();
  }

  async findByFamily(familyId: string): Promise<DirectDebitMandate[]> {
    return await this.mandatesRepository.findByFamily(familyId);
  }

  async findByStatus(status: DirectDebitMandateStatus): Promise<DirectDebitMandate[]> {
    return await this.mandatesRepository.findByStatus(status);
  }

  async findOne(id: string): Promise<DirectDebitMandate> {
    const mandate = await this.mandatesRepository.findOne(id);
    if (!mandate) {
      throw new NotFoundException(`Mandate with ID ${id} not found`);
    }
    return mandate;
  }

  async update(id: string, updateMandateDto: UpdateMandateDto): Promise<DirectDebitMandate> {
    await this.findOne(id);
    const updated = await this.mandatesRepository.update(id, updateMandateDto);
    if (!updated) {
      throw new NotFoundException(`Mandate with ID ${id} not found`);
    }
    return updated;
  }

  async cancel(id: string): Promise<DirectDebitMandate> {
    const mandate = await this.findOne(id);
    if (mandate.status === DirectDebitMandateStatus.CANCELLED) {
      throw new BadRequestException('Mandate is already cancelled');
    }

    // Cancel the mandate at the provider if it has a provider mandate ID
    if (mandate.provider_mandate_id) {
      try {
        const provider = await this.paymentProviders.forClub(mandate.club_id);
        await provider.cancelMandate(mandate.provider_mandate_id);
        this.logger.log(`Cancelled GoCardless mandate: ${mandate.provider_mandate_id}`);
      } catch (error) {
        this.logger.error(
          `Failed to cancel GoCardless mandate: ${mandate.provider_mandate_id}`,
          error,
        );
        // Continue even if provider cancellation fails
      }
    }

    await this.mandatesRepository.updateStatus(id, DirectDebitMandateStatus.CANCELLED);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.mandatesRepository.remove(id);
  }

  /**
   * Create a GoCardless redirect flow to set up a new mandate
   */
  async createRedirectFlow(familyId: string, sessionToken: string, successRedirectUrl: string) {
    // Check if family already has an active mandate
    const existingActive = await this.mandatesRepository.findActiveByFamily(familyId);
    if (existingActive) {
      throw new BadRequestException(
        `Family already has an active mandate (ID: ${existingActive.mandate_id})`,
      );
    }

    try {
      const clubId = this.tenantContext.getClubId();
      // Derive the bank-debit method label and scheme from the club's country
      // so payers outside the UK see their local scheme name (e.g. "ACH bank
      // debit") and GoCardless pins the flow to the matching scheme.
      const club = await this.clubsRepository.findOne(clubId);
      const region = regionForCountry(club?.country);

      const provider = await this.paymentProviders.forClub(clubId);

      // Reuse the provider-side customer a previous (since cancelled or failed)
      // mandate recorded for this family, so providers that model payers as
      // durable customers (Stripe) do not mint a duplicate per setup attempt.
      // Only a customer minted by the SAME provider is meaningful.
      const previousMandates = await this.mandatesRepository.findByFamily(familyId);
      const existingProviderCustomerId = previousMandates.find(
        (m) => m.provider === provider.connection.provider && m.provider_customer_id,
      )?.provider_customer_id;

      const redirectFlow = await provider.startMandateSetup({
        sessionToken,
        successRedirectUrl,
        description: `Set up ${region.paymentMethodLabel} for swim club membership fees`,
        scheme: region.directDebitScheme,
        existingProviderCustomerId: existingProviderCustomerId ?? undefined,
      });

      this.logger.log(`Created redirect flow: ${redirectFlow.flowId} for family: ${familyId}`);

      return {
        redirect_flow_id: redirectFlow.flowId,
        redirect_url: redirectFlow.redirectUrl,
        session_token: sessionToken,
      };
    } catch (error) {
      if (error instanceof ProviderNotConnectedException) {
        // Expected state for a club that has not connected Stripe yet, not a
        // server fault: log at warn and surface parent-facing copy as a 400.
        this.logger.warn(
          `Mandate setup attempted for a club with no payment connection: ${error.message}`,
        );
        throw new BadRequestException(CLUB_PAYMENTS_NOT_SET_UP_MESSAGE);
      }
      this.logger.error('Failed to create redirect flow', error);
      throw error;
    }
  }

  /**
   * Complete a GoCardless redirect flow and create the mandate in our database
   */
  async completeRedirectFlow(
    redirectFlowId: string,
    sessionToken: string,
    familyId: string,
  ): Promise<DirectDebitMandate> {
    try {
      const clubId = this.tenantContext.getClubId();
      const club = await this.clubsRepository.findOne(clubId);
      const scheme = regionForCountry(club?.country).directDebitScheme;

      const provider = await this.paymentProviders.forClub(clubId);
      const completedFlow = await provider.completeMandateSetup({
        flowId: redirectFlowId,
        sessionToken,
      });

      this.logger.log(
        `Completed redirect flow: ${redirectFlowId}, mandate: ${completedFlow.providerMandateId}`,
      );

      // Create the mandate in our database, recording the bank-debit scheme for
      // the club's country. GB clubs record the UK scheme exactly as before.
      // The provider is stamped from the bound connection so webhook routing
      // (which looks records up by provider AND provider id) finds it: a Stripe
      // mandate left on the 'gocardless' default would be invisible to Stripe
      // webhooks.
      const mandate = await this.mandatesRepository.create({
        family_id: familyId,
        provider: provider.connection.provider,
        provider_customer_id: completedFlow.providerCustomerId ?? '',
        provider_mandate_id: completedFlow.providerMandateId,
        status: DirectDebitMandateStatus.ACTIVE,
        scheme,
      });

      this.logger.log(`Created mandate in database: ${mandate.mandate_id}`);

      return mandate;
    } catch (error) {
      this.logger.error('Failed to complete redirect flow', error);
      throw error;
    }
  }

  /**
   * Sync mandate status from GoCardless
   */
  async syncMandateStatus(mandateId: string): Promise<DirectDebitMandate> {
    const mandate = await this.findOne(mandateId);

    if (!mandate.provider_mandate_id) {
      throw new BadRequestException('Mandate does not have a GoCardless ID');
    }

    try {
      const provider = await this.paymentProviders.forClub(mandate.club_id);
      const providerStatus = await provider.getMandateStatus(mandate.provider_mandate_id);

      // Map provider status to our status
      let status: DirectDebitMandateStatus;
      switch (providerStatus) {
        case 'pending_submission':
        case 'submitted':
          status = DirectDebitMandateStatus.PENDING;
          break;
        case 'active':
          status = DirectDebitMandateStatus.ACTIVE;
          break;
        case 'failed':
          status = DirectDebitMandateStatus.FAILED;
          break;
        case 'cancelled':
        case 'expired':
          status = DirectDebitMandateStatus.CANCELLED;
          break;
        default:
          status = mandate.status;
      }

      if (status !== mandate.status) {
        await this.mandatesRepository.updateStatus(mandateId, status);
        this.logger.log(`Synced mandate status: ${mandateId} -> ${status}`);
      }

      return this.findOne(mandateId);
    } catch (error) {
      this.logger.error(`Failed to sync mandate status: ${mandateId}`, error);
      throw error;
    }
  }
}
