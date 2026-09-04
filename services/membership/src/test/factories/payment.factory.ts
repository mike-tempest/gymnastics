import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../modules/finance/payments/entities/payment.entity';

let counter = 0;

export function buildPayment(overrides?: Partial<Payment>): Payment {
  counter += 1;
  const now = new Date();

  const defaults: Payment = {
    payment_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    invoice_id: crypto.randomUUID(),
    amount: 50.0,
    currency: 'GBP',
    payment_date: new Date('2026-04-09'),
    payment_method: PaymentMethod.DIRECT_DEBIT,
    status: PaymentStatus.PENDING_SUBMISSION,
    provider: 'gocardless',
    provider_payment_id: null,
    reference_number: `PAY-${String(counter).padStart(5, '0')}`,
    failure_cause: null,
    failure_description: null,
    notes: null,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
