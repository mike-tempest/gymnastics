'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { billingApi } from '@/lib/api/billing-adjustments';
import { getFamilies, getFamily } from '@/lib/api/families';
import { getFeeStructures } from '@/lib/api/finance';
import { MEMBER_NOUN } from '@/lib/brand';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.');
const amount = z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount.');
const rule = z.object({
  name: z.string().min(1),
  kind: z.enum(['sibling', 'multi_class']),
  percent: z.coerce.number().min(0.01).max(100),
  priority: z.coerce.number().int().min(0),
  group: z.string().min(1),
  minimum: z.coerce.number().int().min(2),
  fee_ids: z.array(z.string()).default([]),
});
const policySchema = z.object({
  effective_date: date,
  proration: z.enum(['full', 'days', 'sessions']),
  stack_groups: z.boolean(),
  pause: z.coerce.number().min(0).max(100),
  cancellation: z.coerce.number().min(0).max(100),
  notice_days: z.coerce.number().int().min(0).max(366),
  discounts: z.array(rule),
});
const revisionSchema = z.object({
  fee_id: z.string().uuid('Choose a fee.'),
  effective_date: date,
  amount,
});
const runSchema = z.object({
  family_id: z.string().uuid('Choose a family.'),
  frequency: z.enum(['monthly', 'term', 'annual', 'one_time']),
  period_start: date,
  period_end: date,
  due_date: date,
  activity: z.array(
    z.object({
      member_id: z.string(),
      name: z.string(),
      active_start: z.string(),
      active_end: z.string(),
    })
  ),
  sessions: z.array(z.object({ fee_id: z.string(), dates: z.string() })),
});
type Policy = z.infer<typeof policySchema>;
type Run = z.infer<typeof runSchema>;
interface Preview {
  preview_hash: string;
  calculation: {
    currency: string;
    total_minor: number;
    tax_minor: number;
    lines: {
      key: string;
      segments: { date: string; amount_minor: number; revision_id: string | null }[];
      description: string;
      units: number;
      period_units: number;
      amount_minor: number;
      discount_minor: number;
      total_minor: number;
    }[];
  };
  policy_id: string | null;
}
interface Configuration {
  policies: { policy_id: string; effective_date: string; policy: { proration: string } }[];
  revisions: {
    revision_id: string;
    fee_structure_id: string;
    effective_date: string;
    amount_minor: string;
  }[];
}
const field = 'min-h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2';
const card = 'space-y-4 rounded-xl border border-slate-200 bg-white p-6';
const errors = (values: object) =>
  Object.values(values).flatMap((e: { message?: string }, i) =>
    e?.message ? (
      <p key={i} role="alert" className="text-red-700">
        {e.message}
      </p>
    ) : (
      []
    )
  );
export default function BillingAdjustmentsPage() {
  const { data: session, status } = useSession();
  const staff = ['super_admin', 'treasurer'].includes(session?.user?.role ?? '');
  const families = useQuery({
    queryKey: ['billing-families'],
    queryFn: getFamilies,
    enabled: staff,
  });
  const fees = useQuery({ queryKey: ['billing-fees'], queryFn: getFeeStructures, enabled: staff });
  const config = useQuery({
    queryKey: ['billing-configuration'],
    queryFn: () => billingApi.get<Configuration>('configuration'),
    enabled: staff,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ result: Preview; input: unknown } | null>(null);
  const policy = useForm<Policy>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      effective_date: '',
      proration: 'full',
      stack_groups: false,
      pause: 0,
      cancellation: 0,
      notice_days: 0,
      discounts: [],
    },
  });
  const discounts = useFieldArray({ control: policy.control, name: 'discounts' });
  const revision = useForm<z.infer<typeof revisionSchema>>({
    resolver: zodResolver(revisionSchema),
    defaultValues: { fee_id: '', effective_date: '', amount: '' },
  });
  const run = useForm<Run>({
    resolver: zodResolver(runSchema),
    defaultValues: {
      family_id: '',
      frequency: 'monthly',
      period_start: '',
      period_end: '',
      due_date: '',
      activity: [],
      sessions: [],
    },
  });
  const familyId = run.watch('family_id');
  const frequency = run.watch('frequency');
  const family = useQuery({
    queryKey: ['billing-family', familyId],
    queryFn: () => getFamily(familyId),
    enabled: staff && !!familyId,
  });
  useEffect(() => {
    run.setValue(
      'activity',
      (family.data?.members ?? []).map((m) => ({
        member_id: m.member_id,
        name: `${m.first_name} ${m.last_name}`,
        active_start: '',
        active_end: '',
      }))
    );
  }, [family.data, run]);
  useEffect(() => {
    run.setValue(
      'sessions',
      (fees.data ?? [])
        .filter((f) => f.frequency === frequency && f.is_active)
        .map((f) => ({ fee_id: f.fee_structure_id, dates: '' }))
    );
  }, [fees.data, frequency, run]);
  const save = useMutation({
    mutationFn: async ({ path, input }: { path: string; input: unknown }) =>
      billingApi.post(path, input),
    onSuccess: async () => {
      setError('');
      setMessage('Saved. Existing invoices keep their original calculation.');
      await config.refetch();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Unable to save'),
  });
  const prepare = useMutation({
    mutationFn: async (value: Run) => {
      const input = {
        ...value,
        activity: value.activity
          .filter((a) => a.active_start || a.active_end)
          .map(({ name: _, ...a }) => a),
        sessions: value.sessions
          .filter((s) => s.dates.trim())
          .map((s) => ({ fee_id: s.fee_id, dates: s.dates.split(/[\s,]+/).filter(Boolean) })),
      };
      return { input, result: await billingApi.post<Preview>('preview', input) };
    },
    onSuccess: (value) => {
      setError('');
      setPreview(value);
    },
    onError: (e) => {
      setPreview(null);
      setError(e instanceof Error ? e.message : 'Unable to preview');
    },
  });
  const generate = useMutation({
    mutationFn: () =>
      billingApi.post<{ invoice_id: string }>('generate', {
        input: preview?.input,
        preview_hash: preview?.result.preview_hash,
      }),
    onSuccess: (value) => {
      setPreview(null);
      setMessage(`Invoice saved: ${value.invoice_id}`);
      window.location.assign(`/billing/${value.invoice_id}`);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Unable to generate invoice'),
  });
  if (status === 'loading')
    return (
      <MainLayout>
        <p>Loading billing controls…</p>
      </MainLayout>
    );
  if (!staff)
    return (
      <MainLayout>
        <p>Billing changes are available to administrators and treasurers.</p>
      </MainLayout>
    );
  const money = (value: number, currency = 'GBP') =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value / 100);
  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Link className="inline-flex min-h-12 items-center underline" href="/billing">
          Back to billing
        </Link>
        <h1 className="text-2xl font-semibold">Billing policies and previews</h1>
        <p>
          Set the rules, preview a family’s invoice, then confirm it. Saving a policy takes no
          payment. Confirmed invoices enter the normal scheduled collection process.
        </p>
        {(families.error || fees.error || config.error) && (
          <p role="alert">Unable to load billing data. Refresh this page to try again.</p>
        )}
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <form
          className={card}
          onChange={() => setPreview(null)}
          onSubmit={run.handleSubmit((v) => prepare.mutate(v))}
        >
          <h2 className="text-xl font-semibold">Preview an invoice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Family
              <select className={field} {...run.register('family_id')}>
                <option value="">Choose a family</option>
                {families.data?.map((f) => (
                  <option key={f.family_id} value={f.family_id}>
                    {f.family_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Frequency
              <select className={field} {...run.register('frequency')}>
                <option value="monthly">Monthly</option>
                <option value="term">Term</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </select>
            </label>
            {(['period_start', 'period_end', 'due_date'] as const).map((name, i) => (
              <label key={name}>
                {['Period starts', 'Period ends (inclusive)', 'Payment due'][i]}
                <input type="date" className={field} {...run.register(name)} />
              </label>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            All applicable fees at this frequency are calculated together. Leave activity dates
            empty for a full active period.
          </p>
          {run.watch('activity').map((a, i) => (
            <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-2" key={a.member_id}>
              <legend>
                {MEMBER_NOUN}: {a.name}
              </legend>
              <label>
                Active from
                <input
                  type="date"
                  className={field}
                  {...run.register(`activity.${i}.active_start`)}
                />
              </label>
              <label>
                Active until
                <input
                  type="date"
                  className={field}
                  {...run.register(`activity.${i}.active_end`)}
                />
              </label>
            </fieldset>
          ))}
          <details>
            <summary className="min-h-12 cursor-pointer py-3">
              Session schedules (required for session-based billing)
            </summary>
            <p className="text-sm">
              Enter one YYYY-MM-DD entry per scheduled session, separated by commas. Repeat the date
              for separate sessions on the same day. These are staff-confirmed billing inputs.
            </p>
            {run.watch('sessions').map((s, i) => (
              <label className="my-3 block" key={s.fee_id}>
                {fees.data?.find((f) => f.fee_structure_id === s.fee_id)?.name}
                <textarea className={field} {...run.register(`sessions.${i}.dates`)} />
              </label>
            ))}
          </details>
          {errors(run.formState.errors)}
          <Button className="min-h-12" disabled={prepare.isPending || generate.isPending}>
            Preview invoice
          </Button>
        </form>
        {preview && (
          <section className={card} aria-label="Invoice preview">
            <h2 className="text-xl font-semibold">Invoice preview</h2>
            <p>
              Family: {families.data?.find((f) => f.family_id === familyId)?.family_name}. Policy:{' '}
              {preview.result.policy_id
                ? 'Effective policy at the period start'
                : 'Default full-period policy'}
              .
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th>Charge</th>
                    <th>Units</th>
                    <th>Rates used</th>
                    <th>Before discount</th>
                    <th>Discount</th>
                    <th>Including tax</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.result.calculation.lines.map((l) => (
                    <tr key={l.key} className="border-t">
                      <td className="py-3">{l.description}</td>
                      <td>
                        {l.units}/{l.period_units}
                      </td>
                      <td>
                        {l.segments
                          .filter(
                            (segment, index) =>
                              index === 0 ||
                              segment.amount_minor !== l.segments[index - 1].amount_minor
                          )
                          .map((segment) => (
                            <p key={segment.date}>
                              {money(segment.amount_minor, preview.result.calculation.currency)}{' '}
                              from {segment.date}
                            </p>
                          ))}
                      </td>
                      <td>{money(l.amount_minor, preview.result.calculation.currency)}</td>
                      <td>{money(l.discount_minor, preview.result.calculation.currency)}</td>
                      <td>{money(l.total_minor, preview.result.calculation.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-semibold">
              Total:{' '}
              {money(preview.result.calculation.total_minor, preview.result.calculation.currency)}{' '}
              (tax{' '}
              {money(preview.result.calculation.tax_minor, preview.result.calculation.currency)})
            </p>
            <Button
              className="min-h-12"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              Confirm and save invoice
            </Button>
          </section>
        )}
        <form
          className={card}
          onSubmit={policy.handleSubmit((v) =>
            save.mutate({
              path: 'policies',
              input: {
                effective_date: v.effective_date,
                policy: {
                  proration: v.proration,
                  stack_groups: v.stack_groups,
                  pause_credit_bp: Math.round(v.pause * 100),
                  cancellation_credit_bp: Math.round(v.cancellation * 100),
                  notice_days: v.notice_days,
                  discounts: v.discounts.map((d, i) => ({
                    id: `rule-${i + 1}`,
                    name: d.name,
                    kind: d.kind,
                    percent_bp: Math.round(d.percent * 100),
                    priority: d.priority,
                    group: d.group,
                    minimum: d.minimum,
                    fee_ids: d.fee_ids,
                  })),
                },
              },
            })
          )}
        >
          <h2 className="text-xl font-semibold">Add a policy version</h2>
          <p>
            Each version replaces the whole policy from its effective date. Historical invoices
            retain their saved policy.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              Effective from
              <input type="date" className={field} {...policy.register('effective_date')} />
            </label>
            <label>
              Proration
              <select className={field} {...policy.register('proration')}>
                <option value="full">Full period</option>
                <option value="days">Active calendar days</option>
                <option value="sessions">Scheduled sessions</option>
              </select>
            </label>
            <label>
              Injury pause credit (%)
              <input type="number" step="0.01" className={field} {...policy.register('pause')} />
            </label>
            <label>
              Club cancellation credit (%)
              <input
                type="number"
                step="0.01"
                className={field}
                {...policy.register('cancellation')}
              />
            </label>
            <label>
              Injury notice period (days)
              <input type="number" className={field} {...policy.register('notice_days')} />
            </label>
          </div>
          <label className="flex min-h-12 items-center gap-3">
            <input type="checkbox" {...policy.register('stack_groups')} />
            Allow discounts from different groups to stack in priority order
          </label>
          {discounts.fields.map((d, i) => (
            <fieldset key={d.id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
              <legend>Discount {i + 1}</legend>
              <label>
                Name
                <input className={field} {...policy.register(`discounts.${i}.name`)} />
              </label>
              <label>
                Eligibility
                <select className={field} {...policy.register(`discounts.${i}.kind`)}>
                  <option value="sibling">Multiple siblings in the family</option>
                  <option value="multi_class">Multiple billable fee assignments</option>
                </select>
              </label>
              <label>
                Discount (%)
                <input
                  type="number"
                  step="0.01"
                  className={field}
                  {...policy.register(`discounts.${i}.percent`)}
                />
              </label>
              <label>
                Minimum eligible count
                <input
                  type="number"
                  className={field}
                  {...policy.register(`discounts.${i}.minimum`)}
                />
              </label>
              <label>
                Priority (lower first)
                <input
                  type="number"
                  className={field}
                  {...policy.register(`discounts.${i}.priority`)}
                />
              </label>
              <label>
                Exclusive group
                <input className={field} {...policy.register(`discounts.${i}.group`)} />
              </label>
              <label>
                Eligible fees (none selected means all)
                <select multiple className={field} {...policy.register(`discounts.${i}.fee_ids`)}>
                  {fees.data?.map((f) => (
                    <option key={f.fee_structure_id} value={f.fee_structure_id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                onClick={() => discounts.remove(i)}
              >
                Remove discount
              </Button>
            </fieldset>
          ))}
          <p className="text-sm text-slate-600">
            Sibling rules apply to all eligible charge lines once the minimum is met. Multi-class
            rules count distinct billable fees, not weekly sessions.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={() =>
              discounts.append({
                name: '',
                kind: 'sibling',
                percent: 10,
                priority: discounts.fields.length + 1,
                group: 'family',
                minimum: 2,
                fee_ids: [],
              })
            }
          >
            Add discount
          </Button>
          {errors(policy.formState.errors)}
          <Button className="ml-3 min-h-12" disabled={save.isPending}>
            Save policy version
          </Button>
          <ul>
            {config.data?.policies.map((p) => (
              <li key={p.policy_id}>
                Effective {String(p.effective_date).slice(0, 10)}: {p.policy.proration} proration
              </li>
            ))}
          </ul>
        </form>
        <form
          className={card}
          onSubmit={revision.handleSubmit((v) =>
            save.mutate({
              path: `fees/${v.fee_id}/revisions`,
              input: { effective_date: v.effective_date, amount: v.amount },
            })
          )}
        >
          <h2 className="text-xl font-semibold">Schedule a fee change</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              Fee
              <select className={field} {...revision.register('fee_id')}>
                <option value="">Choose a fee</option>
                {fees.data?.map((f) => (
                  <option key={f.fee_structure_id} value={f.fee_structure_id}>
                    {f.name} ({f.currency ?? 'GBP'})
                  </option>
                ))}
              </select>
            </label>
            <label>
              New amount
              <input inputMode="decimal" className={field} {...revision.register('amount')} />
            </label>
            <label>
              Effective from
              <input type="date" className={field} {...revision.register('effective_date')} />
            </label>
          </div>
          <p>Preview an invoice above to see how the new rate splits a billing period.</p>
          {errors(revision.formState.errors)}
          <Button className="min-h-12" disabled={save.isPending}>
            Save fee revision
          </Button>
          <ul>
            {config.data?.revisions.map((r) => (
              <li key={r.revision_id}>
                {fees.data?.find((f) => f.fee_structure_id === r.fee_structure_id)?.name}:{' '}
                {money(
                  Number(r.amount_minor),
                  fees.data?.find((f) => f.fee_structure_id === r.fee_structure_id)?.currency
                )}{' '}
                from {String(r.effective_date).slice(0, 10)}
              </li>
            ))}
          </ul>
        </form>
      </div>
    </MainLayout>
  );
}
