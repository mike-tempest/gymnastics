/**
 * GoCardless organisation takeover: recognising and mapping the three CSVs a
 * club downloads from its own GoCardless dashboard.
 *
 * The takeover is built on those exports rather than the GoCardless API,
 * because Partner OAuth is not available to this platform yet. A club can
 * download customers, mandates and payments today without handing anyone API
 * credentials, and the result is the thing that matters: every live Direct
 * Debit moves across, so no parent is asked to re-mandate.
 *
 * A club can drop the three files in any order, so each is recognised from
 * its headers rather than its filename.
 */

import {
  type AutoMapField,
  type CanonicalImportField,
  autoMapHeaders,
  matchHeader,
} from './header-mapping';
import type { ParsedSpreadsheet } from './spreadsheet';

export type GoCardlessFileRole = 'customers' | 'mandates' | 'payments' | 'unknown';

export const GOCARDLESS_FILE_LABELS: Record<GoCardlessFileRole, string> = {
  customers: 'Customers',
  mandates: 'Mandates',
  payments: 'Payments',
  unknown: 'Not recognised',
};

type CustomerField =
  | 'id'
  | 'email'
  | 'given_name'
  | 'family_name'
  | 'company_name'
  | 'phone_number'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'postal_code'
  | 'created_at';

type MandateField = 'id' | 'customer' | 'status' | 'scheme' | 'reference' | 'created_at';

type PaymentField =
  | 'id'
  | 'mandate'
  | 'amount'
  | 'currency'
  | 'status'
  | 'charge_date'
  | 'description';

/**
 * Field keys are the GoCardless column names, so a stock export maps by exact
 * header match; the canonical hints only matter for a club that has renamed
 * or reordered columns in a spreadsheet before uploading.
 */
const CUSTOMER_FIELDS: readonly AutoMapField<CustomerField>[] = [
  { key: 'id', canonical: 'provider_customer_id' },
  { key: 'email', canonical: 'parent_email' },
  { key: 'given_name', canonical: 'first_name' },
  { key: 'family_name', canonical: 'last_name' },
  { key: 'company_name', canonical: null },
  { key: 'phone_number', canonical: 'parent_phone' },
  { key: 'address_line1', canonical: 'address_line1' },
  { key: 'address_line2', canonical: 'address_line2' },
  { key: 'city', canonical: 'city' },
  { key: 'postal_code', canonical: 'postcode' },
  { key: 'created_at', canonical: 'created_at' },
];

const MANDATE_FIELDS: readonly AutoMapField<MandateField>[] = [
  { key: 'id', canonical: 'provider_mandate_id' },
  { key: 'customer', canonical: 'provider_customer_id' },
  { key: 'status', canonical: 'mandate_status' },
  { key: 'scheme', canonical: 'mandate_scheme' },
  { key: 'reference', canonical: 'mandate_reference' },
  { key: 'created_at', canonical: 'created_at' },
];

const PAYMENT_FIELDS: readonly AutoMapField<PaymentField>[] = [
  { key: 'id', canonical: 'provider_payment_id' },
  { key: 'mandate', canonical: 'provider_mandate_id' },
  { key: 'amount', canonical: 'amount' },
  { key: 'currency', canonical: 'currency' },
  { key: 'status', canonical: 'payment_status' },
  { key: 'charge_date', canonical: 'charge_date' },
  { key: 'description', canonical: 'description' },
];

/** Row shapes posted to POST /import/gocardless. */
export interface GoCardlessCustomerRow {
  id: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  company_name?: string;
  phone_number?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postal_code?: string;
  created_at?: string;
}

export interface GoCardlessMandateRow {
  id: string;
  customer: string;
  status: string;
  scheme?: string;
  reference?: string;
  created_at?: string;
}

export interface GoCardlessPaymentRow {
  id: string;
  mandate?: string;
  amount?: string;
  currency?: string;
  status?: string;
  charge_date?: string;
  description?: string;
}

/**
 * Columns that belong to exactly one of the three exports. The id and link
 * columns are deliberately not here: a mandates export that names its own id
 * column "Mandate ID" would otherwise look like a payments file, which names
 * a mandate too.
 */
const DISTINCTIVE_COLUMNS: Array<{
  role: Exclude<GoCardlessFileRole, 'unknown'>;
  canonicals: CanonicalImportField[];
}> = [
  { role: 'payments', canonicals: ['charge_date', 'currency', 'payment_status', 'provider_payment_id'] },
  { role: 'mandates', canonicals: ['mandate_scheme', 'mandate_reference', 'mandate_status'] },
  { role: 'customers', canonicals: ['parent_email', 'first_name', 'last_name'] },
];

/**
 * Work out which of the three exports a spreadsheet is, from its headers.
 *
 * All three carry a bare "id" column and two of them carry a link column, so
 * the decision is made on columns unique to one file first: a charge date or
 * currency means payments, a scheme or reference means mandates, a payer name
 * or email means customers. Only when none of those appear does the link
 * column decide, and a file with nothing recognisable is reported as unknown
 * rather than guessed at.
 */
export function detectGoCardlessFileRole(headers: readonly string[]): GoCardlessFileRole {
  const canonicals = new Set<CanonicalImportField>();
  for (const header of headers) {
    const canonical = matchHeader(header);
    if (canonical) canonicals.add(canonical);
  }

  for (const { role, canonicals: distinctive } of DISTINCTIVE_COLUMNS) {
    if (distinctive.some((canonical) => canonicals.has(canonical))) return role;
  }

  // Nothing distinctive: fall back to the link column, which at least tells
  // us which of the other two files this one points at.
  if (canonicals.has('provider_mandate_id')) return 'payments';
  if (canonicals.has('provider_customer_id')) return 'mandates';
  return 'unknown';
}

function reader<F extends string>(
  sheet: ParsedSpreadsheet,
  fields: readonly AutoMapField<F>[]
): (raw: Record<string, string>, field: F) => string {
  const mapping = autoMapHeaders(sheet.headers, fields);
  return (raw, field) => {
    const header = mapping[field];
    return header ? (raw[header] ?? '').trim() : '';
  };
}

const optional = (value: string) => (value ? value : undefined);

/**
 * Map a customers export. Rows with no id are dropped here rather than sent:
 * a customer with no GoCardless id cannot own a mandate, so it carries no
 * information the takeover can use.
 */
export function mapGoCardlessCustomers(sheet: ParsedSpreadsheet): GoCardlessCustomerRow[] {
  const read = reader(sheet, CUSTOMER_FIELDS);
  return sheet.rows
    .map((raw) => ({
      id: read(raw, 'id'),
      email: optional(read(raw, 'email').toLowerCase()),
      given_name: optional(read(raw, 'given_name')),
      family_name: optional(read(raw, 'family_name')),
      company_name: optional(read(raw, 'company_name')),
      phone_number: optional(read(raw, 'phone_number')),
      address_line1: optional(read(raw, 'address_line1')),
      address_line2: optional(read(raw, 'address_line2')),
      city: optional(read(raw, 'city')),
      postal_code: optional(read(raw, 'postal_code')),
      created_at: optional(read(raw, 'created_at')),
    }))
    .filter((row) => row.id !== '');
}

/**
 * Map a mandates export.
 *
 * A row missing its id, its customer link or its status is dropped: the
 * endpoint rejects the whole batch for one such row, and the row carries
 * nothing importable anyway. The wizard shows the club how many rows of each
 * file were left out, so nothing disappears quietly.
 */
export function mapGoCardlessMandates(sheet: ParsedSpreadsheet): GoCardlessMandateRow[] {
  const read = reader(sheet, MANDATE_FIELDS);
  return sheet.rows
    .map((raw) => ({
      id: read(raw, 'id'),
      customer: read(raw, 'customer'),
      status: read(raw, 'status'),
      scheme: optional(read(raw, 'scheme')),
      reference: optional(read(raw, 'reference')),
      created_at: optional(read(raw, 'created_at')),
    }))
    .filter((row) => row.id !== '' && row.customer !== '' && row.status !== '');
}

/** Map a payments export. Read for reconciliation totals only. */
export function mapGoCardlessPayments(sheet: ParsedSpreadsheet): GoCardlessPaymentRow[] {
  const read = reader(sheet, PAYMENT_FIELDS);
  return sheet.rows
    .map((raw) => ({
      id: read(raw, 'id'),
      mandate: optional(read(raw, 'mandate')),
      amount: optional(read(raw, 'amount').replace(/[£$€,\s]/g, '')),
      currency: optional(read(raw, 'currency').toUpperCase()),
      status: optional(read(raw, 'status')),
      charge_date: optional(read(raw, 'charge_date')),
      description: optional(read(raw, 'description')),
    }))
    .filter((row) => row.id !== '');
}
