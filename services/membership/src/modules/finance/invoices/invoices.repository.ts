import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { CreateInvoiceDto, CreateInvoiceItemDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { TenantScopedHelper } from '../../../common/tenancy/tenant-scoped.helper';
import { TenantContextService } from '../../../common/tenancy/tenant-context.service';

@Injectable()
export class InvoicesRepository {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly invoiceItemRepository: Repository<InvoiceItem>,
    private readonly scoped: TenantScopedHelper,
    private readonly tenantContext: TenantContextService,
  ) {}

  async create(
    createInvoiceDto: CreateInvoiceDto,
    invoiceNumber: string,
    currency?: string,
  ): Promise<Invoice> {
    // Stamp club_id from the active tenant; never trust any club_id in the DTO.
    const { club_id: _ignored, ...rest } = createInvoiceDto as CreateInvoiceDto & {
      club_id?: string;
    };
    const invoice = this.invoiceRepository.create(
      this.scoped.stampCreate<Invoice>({
        ...rest,
        invoice_number: invoiceNumber,
        // Currency is set from the owning club by the service. When omitted the
        // entity default (GBP) applies, preserving prior behaviour.
        ...(currency ? { currency } : {}),
      }),
    );
    return await this.invoiceRepository.save(invoice);
  }

  async createInvoiceItem(invoiceId: string, itemDto: CreateInvoiceItemDto): Promise<InvoiceItem> {
    const total = itemDto.unit_price * (itemDto.quantity || 1);
    // Child row: stamp club_id from the active tenant (same club as the parent
    // invoice, which was loaded/created under the same scoped context).
    const item = this.invoiceItemRepository.create(
      this.scoped.stampCreate<InvoiceItem>({
        invoice_id: invoiceId,
        description: itemDto.description,
        unit_price: itemDto.unit_price,
        quantity: itemDto.quantity || 1,
        total,
        fee_structure_id: itemDto.fee_structure_id,
      }),
    );
    return await this.invoiceItemRepository.save(item);
  }

  async findAll(): Promise<Invoice[]> {
    return await this.scoped.scopedFind(this.invoiceRepository, {
      relations: ['family', 'items', 'payments'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findByFamily(familyId: string): Promise<Invoice[]> {
    return await this.scoped.scopedFind(this.invoiceRepository, {
      where: { family_id: familyId },
      relations: ['items', 'payments'],
      order: {
        created_at: 'DESC',
      },
    });
  }

  async findByStatus(status: InvoiceStatus): Promise<Invoice[]> {
    return await this.scoped.scopedFind(this.invoiceRepository, {
      where: { status },
      relations: ['family', 'items', 'payments'],
      order: {
        due_date: 'ASC',
      },
    });
  }

  async findOverdue(): Promise<Invoice[]> {
    const today = new Date();
    return await this.scoped.scopedFind(this.invoiceRepository, {
      where: {
        status: InvoiceStatus.PENDING,
        due_date: LessThan(today),
      },
      relations: ['family', 'items', 'payments'],
      order: {
        due_date: 'ASC',
      },
    });
  }

  /**
   * Invoices already generated for a fee structure and billing period, in any
   * non-cancelled status. Used by the generation engine to skip families that
   * were already invoiced for the period (idempotency); cancelled invoices are
   * excluded so a family whose invoice was cancelled can be re-invoiced.
   */
  async findByFeeStructureAndPeriod(
    feeStructureId: string,
    billingPeriod: string,
  ): Promise<Invoice[]> {
    return await this.scoped.scopedFind(this.invoiceRepository, {
      where: {
        fee_structure_id: feeStructureId,
        billing_period: billingPeriod,
        status: Not(InvoiceStatus.CANCELLED),
      },
    });
  }

  async findOne(id: string): Promise<Invoice | null> {
    // An invoice_id from another club resolves to null (behaves as not-found).
    return await this.scoped.scopedFindOne(this.invoiceRepository, {
      where: { invoice_id: id },
      relations: ['family', 'items', 'payments'],
    });
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto): Promise<Invoice | null> {
    // Scope the affected-row predicate by club_id so a guessed id from another
    // club cannot be mutated. Never allow club_id to be reassigned via the DTO.
    const { club_id: _ignored, ...rest } = updateInvoiceDto as UpdateInvoiceDto & {
      club_id?: string;
    };
    await this.invoiceRepository.update(
      { invoice_id: id, club_id: this.tenantContext.getClubId() },
      rest,
    );
    return this.findOne(id);
  }

  async updateStatus(id: string, status: InvoiceStatus): Promise<void> {
    await this.invoiceRepository.update(
      { invoice_id: id, club_id: this.tenantContext.getClubId() },
      { status },
    );
  }

  async updateTotals(
    id: string,
    subtotal: number,
    taxAmount: number,
    totalAmount: number,
  ): Promise<void> {
    await this.invoiceRepository.update(
      { invoice_id: id, club_id: this.tenantContext.getClubId() },
      {
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      },
    );
  }

  async remove(id: string): Promise<void> {
    await this.invoiceRepository.delete({
      invoice_id: id,
      club_id: this.tenantContext.getClubId(),
    });
  }

  async count(): Promise<number> {
    return await this.invoiceRepository.count({
      where: { club_id: this.tenantContext.getClubId() },
    });
  }

  async countByStatus(status: InvoiceStatus): Promise<number> {
    return await this.invoiceRepository.count({
      where: { status, club_id: this.tenantContext.getClubId() },
    });
  }

  async getTotalRevenue(): Promise<number> {
    const result = await this.scoped
      .scopedQueryBuilder(this.invoiceRepository, 'invoice')
      .select('SUM(invoice.total_amount)', 'total')
      .andWhere('invoice.status = :status', { status: InvoiceStatus.PAID })
      .getRawOne();
    return parseFloat(result?.total || '0');
  }

  async getTotalOutstanding(): Promise<number> {
    const result = await this.scoped
      .scopedQueryBuilder(this.invoiceRepository, 'invoice')
      .select('SUM(invoice.total_amount)', 'total')
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE],
      })
      .getRawOne();
    return parseFloat(result?.total || '0');
  }

  // ---------------------------------------------------------------------------
  // Non-request (webhook / scheduled-job) variants.
  //
  // These run with NO tenant (CLS) context, so they MUST NOT call getClubId().
  // They are used only by GoCardless webhook handlers and the payment-collection
  // cron job, which legitimately operate across clubs or derive the club from a
  // globally-unique GoCardless id / the entity being processed. Never call these
  // from a request-scoped (controller) path.
  // ---------------------------------------------------------------------------

  /**
   * Unscoped findOne by id. Used by the GoCardless webhook handler, which has no
   * tenant context and locates the invoice via a payment it already matched by
   * the globally-unique GoCardless payment id. Do not use on request paths.
   */
  async findOneUnscoped(id: string): Promise<Invoice | null> {
    return await this.invoiceRepository.findOne({
      where: { invoice_id: id },
      relations: ['family', 'items', 'payments'],
    });
  }

  /**
   * Unscoped findByStatus across all clubs. Used only by the payment-collection
   * cron job, which has no tenant context and must process pending invoices for
   * every club. Do not use on request paths.
   */
  async findByStatusUnscoped(status: InvoiceStatus): Promise<Invoice[]> {
    return await this.invoiceRepository.find({
      where: { status },
      relations: ['family', 'items', 'payments'],
      order: {
        due_date: 'ASC',
      },
    });
  }

  /**
   * Unscoped updateStatus, scoping the predicate by the explicitly supplied
   * club_id derived from the already-loaded entity. Used on non-request paths.
   */
  async updateStatusForClub(id: string, clubId: string, status: InvoiceStatus): Promise<void> {
    await this.invoiceRepository.update({ invoice_id: id, club_id: clubId }, { status });
  }
}
