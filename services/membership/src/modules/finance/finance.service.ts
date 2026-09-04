import { Injectable } from '@nestjs/common';
import { InvoicesRepository } from './invoices/invoices.repository';
import { PaymentsRepository } from './payments/payments.repository';
import { MandatesRepository } from './mandates/mandates.repository';
import { InvoiceStatus } from './invoices/entities/invoice.entity';

export interface FinanceDashboardStats {
  total_outstanding: number;
  overdue_count: number;
  this_month_revenue: number;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly invoicesRepository: InvoicesRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly mandatesRepository: MandatesRepository,
  ) {}

  async getDashboardStats(): Promise<FinanceDashboardStats> {
    const [
      thisMonthRevenue,
      totalOutstanding,
      overdueInvoices,
      paidCount,
      pendingCount,
      totalInvoices,
    ] = await Promise.all([
      this.invoicesRepository.getTotalRevenue(),
      this.invoicesRepository.getTotalOutstanding(),
      this.invoicesRepository.findOverdue(),
      this.invoicesRepository.countByStatus(InvoiceStatus.PAID),
      this.invoicesRepository.countByStatus(InvoiceStatus.PENDING),
      this.invoicesRepository.count(),
    ]);

    return {
      total_outstanding: totalOutstanding,
      overdue_count: overdueInvoices.length,
      this_month_revenue: thisMonthRevenue,
      total_invoices: totalInvoices,
      paid_invoices: paidCount,
      pending_invoices: pendingCount,
    };
  }
}
