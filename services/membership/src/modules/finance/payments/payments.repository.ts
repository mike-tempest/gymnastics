import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly repository: Repository<Payment>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createPaymentDto as CreatePaymentDto & {
      club_id?: string;
    };
    const payment = this.repository.create(this.scoped.stampCreate<Payment>(rest));
    return await this.repository.save(payment);
  }

  async findAll(): Promise<Payment[]> {
    return await this.scoped.scopedFind(this.repository, {
      relations: ['invoice'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { invoice_id: invoiceId },
      order: {
        payment_date: 'DESC',
      },
    });
  }

  async findByStatus(status: PaymentStatus): Promise<Payment[]> {
    return await this.scoped.scopedFind(this.repository, {
      where: { status },
      relations: ['invoice'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Payment | null> {
    // A payment_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.repository, {
      where: { payment_id: id },
      relations: ['invoice'],
    });
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updatePaymentDto as UpdatePaymentDto & {
      club_id?: string;
    };
    await this.repository.update({ payment_id: id, club_id: this.tenantContext.getClubId() }, rest);
    return this.findOne(id);
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<void> {
    await this.repository.update(
      { payment_id: id, club_id: this.tenantContext.getClubId() },
      { status },
    );
  }

  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<void> {
    await this.repository.update(
      { payment_id: id, club_id: this.tenantContext.getClubId() },
      { status },
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({
      payment_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.repository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async getTotalPaymentsByInvoice(invoiceId: string): Promise<number> {
    const result = await this.scoped
      .scopedQueryBuilder(this.repository, 'payment')
      .select('SUM(payment.amount)', 'total')
      .andWhere('payment.invoice_id = :invoiceId', { invoiceId })
      .andWhere('payment.status = :status', { status: PaymentStatus.CONFIRMED })
      .getRawOne();
    return parseFloat(result?.total || '0');
  }

  // ---------------------------------------------------------------------------
  // Non-request (webhook / scheduled-job) variants.
  //
  // These run with NO tenant (CLS) context, so they MUST NOT call getClubId().
  // They are used only by webhook handlers and the payment-collection cron job.
  // They derive club_id from the provider-side id or from the entity being
  // processed. Never call these from a request-scoped path.
  // ---------------------------------------------------------------------------

  /**
   * Unscoped lookup by provider-side payment id, from which the caller derives
   * club_id. The webhook endpoint is public (no tenant context); this is its
   * entry point to locate the payment. Do not use on request paths.
   *
   * Scoped by provider as well as id, matching the (provider, provider_payment_id)
   * unique: an id is only unique WITHIN a provider.
   */
  async findByProviderId(provider: string, providerPaymentId: string): Promise<Payment | null> {
    return await this.repository.findOne({
      where: { provider, provider_payment_id: providerPaymentId },
      relations: ['invoice'],
    });
  }

  /**
   * Unscoped status update, scoping the predicate by the explicitly supplied
   * club_id derived from the already-loaded payment. Used by the GoCardless
   * webhook handler, which has no tenant context. Do not use on request paths.
   *
   * `failure` optionally records the provider's normalised failure cause and
   * human-readable description alongside a FAILED status, so admins and payer
   * emails can say why a collection failed rather than just that it did.
   */
  async updatePaymentStatusForClub(
    id: string,
    clubId: string,
    status: PaymentStatus,
    failure?: { cause: string | null; description: string | null },
  ): Promise<void> {
    await this.repository.update(
      { payment_id: id, club_id: clubId },
      failure
        ? { status, failure_cause: failure.cause, failure_description: failure.description }
        : { status },
    );
  }

  /**
   * Unscoped create stamping the explicitly supplied club_id (derived from the
   * parent invoice). Used by the payment-collection cron job, which has no
   * tenant context. Do not use on request paths.
   */
  async createForClub(createPaymentDto: CreatePaymentDto, clubId: string): Promise<Payment> {
    const { club_id: _ignored, ...rest } = createPaymentDto as CreatePaymentDto & {
      club_id?: string;
    };
    const payment = this.repository.create({
      ...rest,
      club_id: clubId,
    } as DeepPartial<Payment>);
    return await this.repository.save(payment);
  }

  /**
   * Unscoped sum of confirmed payments for an invoice, scoped to the explicitly
   * supplied club_id (derived from the parent invoice). Used by the
   * payment-collection cron job. Do not use on request paths.
   */
  async getTotalPaymentsByInvoiceForClub(invoiceId: string, clubId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.club_id = :clubId', { clubId })
      .andWhere('payment.invoice_id = :invoiceId', { invoiceId })
      .andWhere('payment.status = :status', { status: PaymentStatus.CONFIRMED })
      .getRawOne();
    return parseFloat(result?.total || '0');
  }
}
