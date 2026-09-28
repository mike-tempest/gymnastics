import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import InvoiceAdjustments from '@/components/billing/adjustments/InvoiceAdjustments';
import { billingApi } from '@/lib/api/billing-adjustments';

let role = 'super_admin';
jest.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { role } } }) }));
jest.mock('@/hooks/useConfirm', () => ({
  useConfirm: () => ({ confirm: jest.fn(), ConfirmDialog: () => null }),
}));
jest.mock('@/lib/api/finance', () => ({ getInvoices: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/api/billing-adjustments', () => ({
  billingApi: { history: jest.fn(), post: jest.fn() },
}));
const balance = {
  due_minor: 5000,
  paid_minor: 0,
  credit_notes_minor: 0,
  available_credit_minor: 0,
  pending_minor: 0,
  refunded_minor: 0,
  reserved_refunds_minor: 0,
};
const history = {
  invoice_id: 'invoice',
  family_id: 'family',
  currency: 'GBP',
  balance,
  credits: [],
  operations: [],
};
const show = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <InvoiceAdjustments
        invoiceId="invoice"
        items={[
          {
            item_id: 'item',
            description: 'Monthly fee',
            invoice_id: 'invoice',
            unit_price: 50,
            total: 50,
            quantity: 1,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]}
      />
    </QueryClientProvider>
  );
beforeEach(() => {
  jest.clearAllMocks();
  role = 'super_admin';
  (billingApi.history as jest.Mock).mockResolvedValue(history);
  (billingApi.post as jest.Mock).mockResolvedValue({
    preview_hash: 'hash',
    amount_minor: 1000,
    currency: 'GBP',
    balance,
    resulting_due_minor: 4000,
    resulting_credit_minor: 0,
  });
});
it('previews first and applies the exact frozen credit only after confirmation', async () => {
  show();
  await screen.findByText('Prepare an adjustment');
  fireEvent.change(screen.getByLabelText('Invoice line'), { target: { value: 'item' } });
  fireEvent.change(screen.getByLabelText('Amount (GBP)'), { target: { value: '10.00' } });
  fireEvent.change(screen.getByLabelText('Reason'), {
    target: { value: 'Club session cancelled' },
  });
  fireEvent.click(screen.getByText('Preview adjustment'));
  await screen.findByText('Confirm credit note of £10.00');
  expect(billingApi.post).toHaveBeenCalledTimes(1);
  expect(billingApi.post).toHaveBeenCalledWith(
    'invoices/invoice/credits/preview',
    expect.objectContaining({ amount: '10.00', reason: 'Club session cancelled' })
  );
  fireEvent.click(screen.getByText('Apply credit note'));
  await waitFor(() =>
    expect(billingApi.post).toHaveBeenCalledWith(
      'invoices/invoice/credits',
      expect.objectContaining({
        preview_hash: 'hash',
        input: expect.objectContaining({ amount: '10.00' }),
      })
    )
  );
});
it('shows balances to parents without financial mutation controls', async () => {
  role = 'parent';
  show();
  await screen.findByText('Amount due');
  expect(screen.queryByText('Prepare an adjustment')).not.toBeInTheDocument();
  expect(billingApi.post).not.toHaveBeenCalled();
});
it('invalidates a preview when staff change the amount', async () => {
  show();
  await screen.findByText('Prepare an adjustment');
  fireEvent.change(screen.getByLabelText('Invoice line'), { target: { value: 'item' } });
  fireEvent.change(screen.getByLabelText('Amount (GBP)'), { target: { value: '10.00' } });
  fireEvent.change(screen.getByLabelText('Reason'), {
    target: { value: 'Club session cancelled' },
  });
  fireEvent.click(screen.getByText('Preview adjustment'));
  await screen.findByText('Apply credit note');
  fireEvent.change(screen.getByLabelText('Amount (GBP)'), { target: { value: '20.00' } });
  expect(screen.queryByText('Apply credit note')).not.toBeInTheDocument();
});
