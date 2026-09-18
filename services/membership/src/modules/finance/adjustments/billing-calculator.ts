import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export function canonicalHash(input: unknown): string {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(canonical(input)))
    .digest('hex');
}
export function minor(value: string | number): number {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new BadRequestException('Use a non-negative amount with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount > 9999999999)
    throw new BadRequestException('Amount is too large');
  return amount;
}
export function money(amount: number): string {
  if (!Number.isSafeInteger(amount)) throw new BadRequestException('Invalid minor-unit amount');
  return `${amount < 0 ? '-' : ''}${Math.floor(Math.abs(amount) / 100)}.${String(Math.abs(amount) % 100).padStart(2, '0')}`;
}
export function dateKey(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException('Enter a valid calendar date');
  return value;
}
export function days(start: string, end: string): string[] {
  dateKey(start);
  dateKey(end);
  const count = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
  if (count < 1 || count > 366)
    throw new BadRequestException('Billing periods must contain 1 to 366 days');
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
  );
}
export function roundRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n)
    throw new BadRequestException('The billing period has no chargeable units');
  const result = Number((numerator * 2n + denominator) / (denominator * 2n));
  if (!Number.isSafeInteger(result))
    throw new BadRequestException('Calculated amount is too large');
  return result;
}
export interface DiscountRule {
  id: string;
  name: string;
  kind: 'sibling' | 'multi_class';
  percent_bp: number;
  priority: number;
  group: string;
  minimum: number;
  fee_ids: string[];
}
export interface BillingPolicy {
  proration: 'full' | 'days' | 'sessions';
  discounts: DiscountRule[];
  stack_groups: boolean;
  pause_credit_bp: number;
  cancellation_credit_bp: number;
  notice_days: number;
}
export const DEFAULT_POLICY: BillingPolicy = {
  proration: 'full',
  discounts: [],
  stack_groups: false,
  pause_credit_bp: 0,
  cancellation_credit_bp: 0,
  notice_days: 0,
};
export interface ChargeInput {
  key: string;
  fee_id: string;
  member_id: string | null;
  class_id: string | null;
  description: string;
  amount_minor: number;
  revisions: { effective_date: string; amount_minor: number; revision_id: string }[];
  active_start: string;
  active_end: string;
  session_dates: string[];
}
export interface CalculationInput {
  period_start: string;
  period_end: string;
  currency: string;
  tax_bp: number;
  tax_inclusive: boolean;
  policy: BillingPolicy;
  charges: ChargeInput[];
}
export function calculateBilling(input: CalculationInput) {
  if (!['GBP', 'EUR', 'USD', 'AUD', 'CAD', 'NZD'].includes(input.currency))
    throw new BadRequestException(
      'This billing workflow supports currencies with two decimal places only',
    );
  if (!Number.isInteger(input.tax_bp) || input.tax_bp < 0 || input.tax_bp > 10000)
    throw new BadRequestException('Invalid tax rate');
  for (const rule of input.policy.discounts) {
    if (
      !Number.isInteger(rule.percent_bp) ||
      rule.percent_bp < 1 ||
      rule.percent_bp > 10000 ||
      !Number.isInteger(rule.minimum) ||
      rule.minimum < 2
    )
      throw new BadRequestException('Invalid discount rule');
  }
  if (new Set(input.charges.map((charge) => charge.key)).size !== input.charges.length)
    throw new BadRequestException('Duplicate charge');
  if (input.charges.length > 1000) throw new BadRequestException('Too many billable lines');
  const calendar = days(input.period_start, input.period_end);
  const lines = [...input.charges]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((charge) => {
      dateKey(charge.active_start);
      dateKey(charge.active_end);
      const units =
        input.policy.proration === 'sessions' ? [...charge.session_dates].sort() : calendar;
      if (!units.length)
        throw new BadRequestException(
          `No scheduled sessions for ${charge.description}; choose day or full-period billing`,
        );
      for (const unit of units)
        if (dateKey(unit) < input.period_start || unit > input.period_end)
          throw new BadRequestException('Session outside billing period');
      if (charge.active_start > charge.active_end)
        throw new BadRequestException('Active dates are reversed');
      const overlaps =
        charge.active_start <= input.period_end && charge.active_end >= input.period_start;
      const active = units.filter(
        (date) =>
          overlaps &&
          (input.policy.proration === 'full' ||
            (date >= charge.active_start && date <= charge.active_end)),
      );
      let numerator = 0n;
      const segments: { date: string; amount_minor: number; revision_id: string | null }[] = [];
      for (const unit of active) {
        const revision = [...charge.revisions]
          .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
          .find((r) => r.effective_date <= unit);
        const amount = revision?.amount_minor ?? charge.amount_minor;
        if (!Number.isSafeInteger(amount) || amount < 0)
          throw new BadRequestException('Invalid fee amount');
        numerator += BigInt(amount);
        segments.push({
          date: unit,
          amount_minor: amount,
          revision_id: revision?.revision_id ?? null,
        });
      }
      const amount = roundRatio(numerator, BigInt(units.length));
      return {
        ...charge,
        units: active.length,
        period_units: units.length,
        segments,
        amount_minor: amount,
        discount_minor: 0,
        discounts: [] as { rule_id: string; name: string; amount_minor: number }[],
        tax_minor: 0,
        total_minor: 0,
      };
    });
  const usedGroups = new Set<string>();
  for (const rule of [...input.policy.discounts].sort(
    (a, b) => a.priority - b.priority || a.id.localeCompare(b.id),
  )) {
    const group = input.policy.stack_groups ? rule.group : 'all';
    if (usedGroups.has(group)) continue;
    const relevant = lines.filter(
      (line) =>
        line.member_id &&
        line.amount_minor > 0 &&
        (!rule.fee_ids.length || rule.fee_ids.includes(line.fee_id)),
    );
    const members = new Set(relevant.map((line) => line.member_id));
    const eligible = relevant
      .filter((line) => {
        if (!line.member_id || (rule.fee_ids.length && !rule.fee_ids.includes(line.fee_id)))
          return false;
        if (rule.kind === 'sibling') return members.size >= rule.minimum;
        return (
          new Set(
            relevant
              .filter((l) => l.member_id === line.member_id && l.class_id && l.amount_minor > 0)
              .map((l) => l.class_id),
          ).size >= rule.minimum
        );
      })
      .filter((line) => line.amount_minor > line.discount_minor);
    if (!eligible.length) continue;
    usedGroups.add(group);
    const balances = eligible.map((line) => line.amount_minor - line.discount_minor);
    const total = balances.reduce((a, b) => a + b, 0);
    const target = roundRatio(BigInt(total) * BigInt(rule.percent_bp), 10000n);
    const allocations = balances.map((amount, index) => ({
      index,
      amount: Math.floor((amount * rule.percent_bp) / 10000),
      remainder: (amount * rule.percent_bp) % 10000,
    }));
    let remainder = target - allocations.reduce((sum, a) => sum + a.amount, 0);
    for (const allocation of [...allocations].sort(
      (a, b) => b.remainder - a.remainder || a.index - b.index,
    ))
      if (remainder-- > 0) allocation.amount++;
    for (const allocation of allocations) {
      const line = eligible[allocation.index];
      line.discount_minor += allocation.amount;
      line.discounts.push({ rule_id: rule.id, name: rule.name, amount_minor: allocation.amount });
    }
  }
  for (const line of lines) {
    const net = line.amount_minor - line.discount_minor;
    line.tax_minor = roundRatio(
      BigInt(net) * BigInt(input.tax_bp),
      BigInt(input.tax_inclusive ? 10000 + input.tax_bp : 10000),
    );
    line.total_minor = input.tax_inclusive ? net : net + line.tax_minor;
  }
  const total = lines.reduce((sum, line) => sum + line.total_minor, 0);
  if (!Number.isSafeInteger(total) || total > 9999999999)
    throw new BadRequestException('Invoice is too large');
  const tax = lines.reduce((sum, line) => sum + line.tax_minor, 0);
  return {
    currency: input.currency,
    tax_bp: input.tax_bp,
    tax_inclusive: input.tax_inclusive,
    lines,
    subtotal_minor: total - tax,
    tax_minor: tax,
    total_minor: total,
  };
}
