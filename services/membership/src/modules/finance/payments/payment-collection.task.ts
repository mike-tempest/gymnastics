import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentCollectionTask {
  private readonly logger = new Logger(PaymentCollectionTask.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Scheduled job to collect payments for pending invoices
   * Runs every day at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async collectPendingPayments() {
    this.logger.log('Starting scheduled payment collection job');

    try {
      const stats = await this.paymentsService.collectPendingInvoicePayments();

      this.logger.log(
        `Scheduled payment collection completed: ${stats.successful} successful, ${stats.failed} failed, ${stats.skipped} skipped out of ${stats.attempted} attempted`,
      );

      // Log a warning if there were failures
      if (stats.failed > 0) {
        this.logger.warn(`${stats.failed} payment collection(s) failed during scheduled job`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Scheduled payment collection job failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Manual trigger for testing (can be called from a controller endpoint if needed)
   */
  async manualTrigger() {
    this.logger.log('Manually triggering payment collection');
    return this.collectPendingPayments();
  }
}
