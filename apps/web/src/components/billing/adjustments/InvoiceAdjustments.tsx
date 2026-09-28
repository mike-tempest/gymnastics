'use client';

import { InvoiceItem, Payment } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/useConfirm';
import { AdjustmentPreview, billingApi } from '@/lib/api/billing-adjustments';
import { getInvoices } from '@/lib/api/finance';

const schema = z
  .object({
    action: z.enum(['credit', 'refund']),
    item_id: z.string(),
    payment_id: z.string(),
    kind: z.enum(['manual', 'injury_pause', 'club_cancellation']),
    amount: z.string(),
    reason: z.string().trim().min(5, 'Please explain the adjustment.'),
    start_date: z.string(),
    end_date: z.string(),
    notice_date: z.string(),
  })
  .superRefine((v, ctx) => {
    if ((v.action === 'refund' || v.kind === 'manual') && !/^\d+(\.\d{1,2})?$/.test(v.amount))
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Enter an amount with up to two decimal places.',
      });
    if (v.action === 'credit' && !v.item_id)
      ctx.addIssue({ code: 'custom', path: ['item_id'], message: 'Choose an invoice line.' });
    if (v.action === 'refund' && !v.payment_id)
      ctx.addIssue({
        code: 'custom',
        path: ['payment_id'],
        message: 'Choose a confirmed provider payment.',
      });
    if (v.action === 'credit' && v.kind !== 'manual' && (!v.start_date || !v.end_date))
      ctx.addIssue({ code: 'custom', path: ['start_date'], message: 'Enter the event dates.' });
  });
type Form = z.infer<typeof schema>;
const allocationSchema = z.object({
  target_invoice_id: z.string().uuid('Choose an invoice.'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.'),
});
const field =
  'min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900';
export default function InvoiceAdjustments({
  invoiceId,
  invoiceNumber,
  familyName,
  items = [],
  payments = [],
  onChanged,
}: {
  invoiceId: string;
  invoiceNumber?: string;
  familyName?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  onChanged?: () => void;
}) {
  const { data: session } = useSession();
  const staff = ['super_admin', 'treasurer'].includes(session?.user?.role ?? '');
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const history = useQuery({
    queryKey: ['billing-adjustments', invoiceId],
    queryFn: () => billingApi.history(invoiceId),
  });
  const [preview, setPreview] = useState<{
    result: AdjustmentPreview;
    input: Record<string, unknown>;
    action: string;
    operationId: string;
  } | null>(null);
  const [error, setError] = useState('');
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      action: 'credit',
      item_id: '',
      payment_id: '',
      kind: 'manual',
      amount: '',
      reason: '',
      start_date: '',
      end_date: '',
      notice_date: '',
    },
  });
  const allocation = useForm<z.infer<typeof allocationSchema>>({
    resolver: zodResolver(allocationSchema),
    defaultValues: { target_invoice_id: '', amount: '' },
  });
  const [allocationKey, setAllocationKey] = useState('');
  const targets = useQuery({
    queryKey: ['allocation-invoices', history.data?.family_id],
    queryFn: () => getInvoices({ family_id: history.data?.family_id }),
    enabled: staff && !!history.data?.family_id,
  });
  const action = form.watch('action');
  const kind = form.watch('kind');
  const currency = history.data?.currency ?? 'GBP';
  const money = (value: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value / 100);
  const changed = async () => {
    setPreview(null);
    await queryClient.invalidateQueries({ queryKey: ['billing-adjustments', invoiceId] });
    onChanged?.();
  };
  const mutation = useMutation({
    mutationFn: async (v: Form) => {
      const operationId = crypto.randomUUID();
      const input =
        v.action === 'refund'
          ? { payment_id: v.payment_id, amount: v.amount, reason: v.reason }
          : {
              item_id: v.item_id,
              kind: v.kind,
              reason: v.reason,
              source_event: operationId,
              ...(v.kind === 'manual'
                ? { amount: v.amount }
                : {
                    start_date: v.start_date,
                    end_date: v.end_date,
                    ...(v.notice_date ? { notice_date: v.notice_date } : {}),
                  }),
            };
      const result = await billingApi.post<AdjustmentPreview>(
        `invoices/${invoiceId}/${v.action === 'refund' ? 'refunds' : 'credits'}/preview`,
        input
      );
      return { result, input, action: v.action, operationId };
    },
    onSuccess: (value) => {
      setError('');
      setPreview(value);
    },
    onError: (e) => {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Unable to prepare adjustment');
    },
  });
  const commit = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      await billingApi.post(
        `invoices/${invoiceId}/${preview.action === 'refund' ? 'refunds' : 'credits'}`,
        {
          input: preview.input,
          preview_hash: preview.result.preview_hash,
          ...(preview.action === 'refund' ? { operation_id: preview.operationId } : {}),
        }
      );
    },
    onSuccess: changed,
    onError: (e) => setError(e instanceof Error ? e.message : 'Unable to apply adjustment'),
  });
  if (history.isLoading) return <p role="status">Loading invoice adjustments…</p>;
  if (history.error)
    return (
      <p role="alert">
        Unable to load invoice adjustments.{' '}
        <Button variant="outline" className="min-h-12" onClick={() => history.refetch()}>
          Try again
        </Button>
      </p>
    );
  const data = history.data;
  if (!data) return null;
  return (
    <section
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
      aria-label="Invoice adjustments"
    >
      <ConfirmDialog />
      <h2 className="text-xl font-semibold">Invoice adjustments</h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          ['Amount due', data.balance.due_minor],
          ['Collection pending', data.balance.pending_minor],
          ['Available credit', data.balance.available_credit_minor],
          ['Credit notes', data.balance.credit_notes_minor],
          ['Cash refunded', data.balance.refunded_minor],
          ['Refund pending', data.balance.reserved_refunds_minor],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate-600">{label}</dt>
            <dd className="font-semibold">{money(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {data.runs
        ?.flatMap((run) => run.snapshot.items)
        .map((item) => (
          <div key={item.item_id} className="border-t pt-3 text-sm">
            <p>
              {item.description}: {item.units} of {item.period_units} billing units,{' '}
              {money(item.amount_minor)} before discounts and tax.
            </p>
            {item.discounts.map((d, i) => (
              <p key={i}>
                {d.name}: −{money(d.amount_minor)}
              </p>
            ))}
          </div>
        ))}
      {data.credits.length > 0 && (
        <div>
          <h3 className="font-medium">Credit history</h3>
          <ul className="divide-y">
            {data.credits.map((c) => (
              <li key={c.credit_id} className="py-3">
                {c.kind === 'reversal' ? 'Credit reversed' : 'Credit issued'}:{' '}
                {money(Number(c.amount_minor))}. {c.reason}
                {staff &&
                  c.kind === 'credit' &&
                  !data.credits.some((r) => r.reverses_id === c.credit_id) && (
                    <Button
                      variant="outline"
                      className="ml-3 min-h-12"
                      onClick={async () => {
                        if (
                          await confirm({
                            title: 'Reverse this credit?',
                            description: `Reverse ${money(Number(c.amount_minor))} for this invoice? A transferred or refunded credit cannot be reversed.`,
                          })
                        ) {
                          try {
                            await billingApi.post(
                              `invoices/${invoiceId}/credits/${c.credit_id}/reverse`,
                              { reason: 'Staff correction of invoice credit' }
                            );
                            await changed();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Unable to reverse credit');
                          }
                        }
                      }}
                    >
                      Reverse credit
                    </Button>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.operations.length > 0 && (
        <div>
          <h3 className="font-medium">Payment operations</h3>
          <ul className="divide-y">
            {data.operations.map((o, i) => (
              <li key={o.operation_id ?? i} className="py-3">
                {o.kind === 'refund' ? 'Refund' : 'Collection'}: {money(Number(o.amount_minor))},{' '}
                {o.state}. {o.error}
                {staff && o.operation_id && (
                  <Button
                    variant="outline"
                    className="ml-3 min-h-12"
                    onClick={async () => {
                      try {
                        await billingApi.post(`operations/${o.operation_id}/reconcile`, {});
                        await changed();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Unable to reconcile');
                      }
                    }}
                  >
                    Check provider status
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {staff && (
        <form
          className="space-y-4 border-t pt-5"
          onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          onChange={() => setPreview(null)}
        >
          <h3 className="font-medium">Prepare an adjustment</h3>
          <label className="block">
            Action
            <select className={field} {...form.register('action')}>
              <option value="credit">Issue a credit note</option>
              <option value="refund">Refund available credit</option>
            </select>
          </label>
          {action === 'credit' ? (
            <>
              <label className="block">
                Invoice line
                <select className={field} {...form.register('item_id')}>
                  <option value="">Choose a line</option>
                  {items.map((i) => (
                    <option key={i.item_id} value={i.item_id}>
                      {i.description}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Credit policy
                <select className={field} {...form.register('kind')}>
                  <option value="manual">Specified amount</option>
                  <option value="injury_pause">Injury pause</option>
                  <option value="club_cancellation">Club cancellation</option>
                </select>
              </label>
            </>
          ) : (
            <label className="block">
              Source payment
              <select className={field} {...form.register('payment_id')}>
                <option value="">Choose a payment</option>
                {payments
                  .filter((p) => p.status === 'confirmed')
                  .map((p) => (
                    <option key={p.payment_id} value={p.payment_id}>
                      {money(Math.round(Number(p.amount) * 100))} ({p.payment_id.slice(0, 8)})
                    </option>
                  ))}
              </select>
            </label>
          )}
          {action === 'refund' || kind === 'manual' ? (
            <label className="block">
              Amount ({currency})
              <input className={field} inputMode="decimal" {...form.register('amount')} />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                First affected date
                <input type="date" className={field} {...form.register('start_date')} />
              </label>
              <label>
                Last affected date
                <input type="date" className={field} {...form.register('end_date')} />
              </label>
              <label>
                Notice received
                <input type="date" className={field} {...form.register('notice_date')} />
              </label>
            </div>
          )}
          <label className="block">
            Reason
            <textarea className={field} {...form.register('reason')} />
          </label>
          {Object.values(form.formState.errors).map((e, i) => (
            <p role="alert" key={i}>
              {e.message}
            </p>
          ))}
          <Button className="min-h-12" disabled={mutation.isPending || commit.isPending}>
            Preview adjustment
          </Button>
        </form>
      )}
      {preview && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-4" role="status">
          <h3 className="font-semibold">
            Confirm {preview.action === 'refund' ? 'cash refund' : 'credit note'} of{' '}
            {money(preview.result.amount_minor)}
          </h3>
          <p>
            Invoice {invoiceNumber ?? invoiceId}. Family:{' '}
            {familyName ?? data.family_id ?? 'Your family'}.
          </p>
          <p>{String(preview.input.reason)}</p>
          <p>
            {preview.action === 'refund'
              ? `Source payment: ${String(preview.input.payment_id)}`
              : `Source charge: ${items.find((item) => item.item_id === preview.input.item_id)?.description ?? ''}. Policy: ${String(preview.input.kind).replaceAll('_', ' ')}.`}
          </p>
          {preview.action === 'credit' ? (
            <p>
              Amount due after credit: {money(preview.result.resulting_due_minor ?? 0)}. Available
              credit: {money(preview.result.resulting_credit_minor ?? 0)}.
            </p>
          ) : (
            <p>
              This returns available credit to the original payment method. Completion depends on
              confirmation from the provider. Available credit after reservation:{' '}
              {money(preview.result.balance.available_credit_minor - preview.result.amount_minor)}.
            </p>
          )}
          <Button className="min-h-12" disabled={commit.isPending} onClick={() => commit.mutate()}>
            {commit.isPending
              ? 'Applying…'
              : preview.action === 'refund'
                ? 'Confirm refund'
                : 'Apply credit note'}
          </Button>
          <Button className="ml-3 min-h-12" variant="outline" onClick={() => setPreview(null)}>
            Cancel
          </Button>
        </div>
      )}
      {staff && data.balance.available_credit_minor > 0 && (
        <form
          className="space-y-3 border-t pt-4"
          onSubmit={allocation.handleSubmit(async (value) => {
            const target = targets.data?.find((i) => i.invoice_id === value.target_invoice_id);
            if (!target) return;
            if (
              !(await confirm({
                title: 'Apply credit to another invoice?',
                description: `Apply ${money(Math.round(Number(value.amount) * 100))} to ${target.invoice_number} for this family?`,
              }))
            )
              return;
            const key = allocationKey || crypto.randomUUID();
            setAllocationKey(key);
            try {
              await billingApi.post(`invoices/${invoiceId}/allocate`, {
                ...value,
                source_event: key,
              });
              setAllocationKey('');
              allocation.reset();
              await changed();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to allocate credit');
            }
          })}
          onChange={() => setAllocationKey('')}
        >
          <h3 className="font-medium">Apply credit to another invoice</h3>
          <label className="block">
            Target invoice
            <select className={field} {...allocation.register('target_invoice_id')}>
              <option value="">Choose an unpaid invoice</option>
              {targets.data
                ?.filter(
                  (i) =>
                    i.invoice_id !== invoiceId &&
                    i.family_id === data.family_id &&
                    i.currency === currency &&
                    ['pending', 'sent', 'overdue'].includes(i.status)
                )
                .map((i) => (
                  <option key={i.invoice_id} value={i.invoice_id}>
                    {i.invoice_number}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            Credit amount ({currency})
            <input className={field} inputMode="decimal" {...allocation.register('amount')} />
          </label>
          {Object.values(allocation.formState.errors).map((e, i) => (
            <p key={i} role="alert">
              {e.message}
            </p>
          ))}
          <Button className="min-h-12">Review credit transfer</Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
