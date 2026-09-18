import {
  calculateBilling,
  CalculationInput,
  DEFAULT_POLICY,
  minor,
  days,
  canonicalHash,
} from './billing-calculator';
import { calculateBalance, BalanceInputs } from './billing-balance.service';
const input = (overrides: Partial<CalculationInput> = {}): CalculationInput => ({
  period_start: '2028-02-01',
  period_end: '2028-02-29',
  currency: 'GBP',
  tax_bp: 0,
  tax_inclusive: false,
  policy: { ...DEFAULT_POLICY, proration: 'days' },
  charges: [
    {
      key: 'one',
      fee_id: 'fee',
      member_id: 'member',
      class_id: 'class',
      description: 'Monthly fee',
      amount_minor: 2900,
      revisions: [],
      active_start: '2028-02-15',
      active_end: '2028-02-29',
      session_dates: [],
    },
  ],
  ...overrides,
});
describe('billing calculation', () => {
  it('charges the inclusive active days in a leap month', () =>
    expect(calculateBilling(input()).total_minor).toBe(1500));
  it('rejects impossible dates and reversed periods', () => {
    expect(() => days('2027-02-29', '2027-03-01')).toThrow();
    expect(() => days('2028-02-29', '2028-02-01')).toThrow();
  });
  it('does not charge an inactive period even with full-period policy', () => {
    const i = input({ policy: DEFAULT_POLICY });
    i.charges[0].active_start = '2028-03-01';
    i.charges[0].active_end = '2028-03-31';
    expect(calculateBilling(i).total_minor).toBe(0);
  });
  it('splits at the effective date of a new fee', () => {
    const i = input();
    i.charges[0].revisions = [
      { effective_date: '2028-02-20', amount_minor: 5800, revision_id: 'revision' },
    ];
    expect(calculateBilling(i).total_minor).toBe(2500);
  });
  it('counts separate scheduled sessions on the same date', () => {
    const i = input({ policy: { ...DEFAULT_POLICY, proration: 'sessions' } });
    i.charges[0].session_dates = ['2028-02-01', '2028-02-15', '2028-02-29', '2028-02-29'];
    expect(calculateBilling(i).total_minor).toBe(2175);
  });
  it('requires sessions for session proration', () =>
    expect(() =>
      calculateBilling(input({ policy: { ...DEFAULT_POLICY, proration: 'sessions' } })),
    ).toThrow());
  it.each([
    [false, 1800, 300],
    [true, 1500, 250],
  ])('calculates tax inclusive=%s', (inclusive, total, tax) => {
    const result = calculateBilling(input({ tax_bp: 2000, tax_inclusive: inclusive }));
    expect(result.total_minor).toBe(total);
    expect(result.tax_minor).toBe(tax);
  });
  it('allocates a rounded sibling discount deterministically and does not stack by default', () => {
    const i = input({
      policy: {
        ...DEFAULT_POLICY,
        discounts: [
          {
            id: 'sibling',
            name: 'Sibling',
            kind: 'sibling',
            percent_bp: 5000,
            priority: 1,
            group: 'siblings',
            minimum: 2,
            fee_ids: [],
          },
          {
            id: 'second',
            name: 'Second',
            kind: 'sibling',
            percent_bp: 5000,
            priority: 2,
            group: 'other',
            minimum: 2,
            fee_ids: [],
          },
        ],
      },
    });
    i.charges = [
      { ...i.charges[0], key: 'b', amount_minor: 101 },
      { ...i.charges[0], key: 'a', member_id: 'second', amount_minor: 101 },
    ];
    const result = calculateBilling(i);
    expect(result.total_minor).toBe(101);
    expect(result.lines.map((l) => l.discount_minor)).toEqual([51, 50]);
    i.charges.reverse();
    expect(calculateBilling(i)).toEqual(result);
    i.policy.stack_groups = true;
    expect(calculateBilling(i).total_minor).toBe(50);
  });
  it('counts distinct billable assignments for multi-class discounts', () => {
    const i = input({
      policy: {
        ...DEFAULT_POLICY,
        discounts: [
          {
            id: 'multi',
            name: 'Multi-class',
            kind: 'multi_class',
            percent_bp: 1000,
            priority: 1,
            group: 'multi',
            minimum: 2,
            fee_ids: [],
          },
        ],
      },
    });
    i.charges = [i.charges[0], { ...i.charges[0], key: 'two' }];
    expect(calculateBilling(i).total_minor).toBe(5800);
    i.charges[1].class_id = 'other';
    expect(calculateBilling(i).total_minor).toBe(5220);
  });
  it.each(['0.001', '-1', 'NaN', '1e9'])('rejects invalid money %s', (value) =>
    expect(() => minor(value)).toThrow(),
  );
  it('canonicalises object key order without changing array order', () => {
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }));
    expect(canonicalHash([1, 2])).not.toBe(canonicalHash([2, 1]));
  });
});
const ledger = (overrides: Partial<BalanceInputs> = {}) =>
  calculateBalance({
    total: 10000,
    credits: 0,
    incoming: 0,
    outgoing: 0,
    paid: 0,
    pending: 0,
    collections: 0,
    refunds: 0,
    confirmedRefunds: 0,
    ...overrides,
  });
describe('one balance for display and collection', () => {
  it('reserves in-flight payments and unlinked durable intents', () =>
    expect(ledger({ paid: 2000, pending: 3000, collections: 1000, credits: 1000 })).toMatchObject({
      due_minor: 7000,
      collectable_minor: 3000,
    }));
  it('creates credit only after payments exceed adjusted charges', () => {
    expect(ledger({ credits: 3000 }).available_credit_minor).toBe(0);
    expect(ledger({ credits: 3000, paid: 10000 }).available_credit_minor).toBe(3000);
  });
  it('does not reopen a debt when returning overpaid cash', () =>
    expect(
      ledger({ credits: 3000, paid: 10000, refunds: 3000, confirmedRefunds: 3000 }),
    ).toMatchObject({ due_minor: 0, collectable_minor: 0, available_credit_minor: 0 }));
  it('cannot allocate or refund reserved credit twice', () =>
    expect(ledger({ credits: 3000, paid: 10000, refunds: 1000, outgoing: 2000 })).toMatchObject({
      available_credit_minor: 0,
      due_minor: 0,
    }));
  it('applies an allocation against the target receivable', () =>
    expect(ledger({ incoming: 2000, paid: 3000 })).toMatchObject({
      due_minor: 5000,
      collectable_minor: 5000,
    }));
});
