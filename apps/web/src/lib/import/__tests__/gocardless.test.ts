import { readFileSync } from 'fs';
import { join } from 'path';

import {
  detectGoCardlessFileRole,
  mapGoCardlessCustomers,
  mapGoCardlessMandates,
  mapGoCardlessPayments,
} from '../gocardless';
import { type ParsedSpreadsheet, parseCsvText } from '../spreadsheet';

/**
 * Fixture provenance: the same three CSVs the membership service specs use,
 * reproducing the column layout of a club's own GoCardless dashboard exports.
 * docs/04-Incumbent-Landscape-Pricing-and-Exports.md names "DIY tooling
 * (GoCardless + spreadsheet)" as the most common "system" among the target
 * clubs, which is why this importer comes first.
 */
function sheet(fileName: string): ParsedSpreadsheet {
  return parseCsvText(readFileSync(join(__dirname, '__fixtures__', fileName), 'utf8'));
}

const customers = () => sheet('gocardless-customers.csv');
const mandates = () => sheet('gocardless-mandates.csv');
const payments = () => sheet('gocardless-payments.csv');

describe('detectGoCardlessFileRole', () => {
  it('recognises each of the three dashboard exports from its headers', () => {
    expect(detectGoCardlessFileRole(customers().headers)).toBe('customers');
    expect(detectGoCardlessFileRole(mandates().headers)).toBe('mandates');
    expect(detectGoCardlessFileRole(payments().headers)).toBe('payments');
  });

  it('does not confuse the three files, which all carry a bare id column', () => {
    // The link column is the discriminator: only payments name a mandate,
    // only mandates name a customer.
    expect(detectGoCardlessFileRole(['id', 'created_at', 'status', 'scheme', 'customer'])).toBe(
      'mandates'
    );
    expect(detectGoCardlessFileRole(['id', 'charge_date', 'amount', 'mandate'])).toBe('payments');
    expect(detectGoCardlessFileRole(['id', 'email', 'given_name', 'family_name'])).toBe(
      'customers'
    );
  });

  it('reports an unrelated spreadsheet rather than guessing', () => {
    expect(detectGoCardlessFileRole(['Wibble', 'Wobble'])).toBe('unknown');
  });
});

describe('mapGoCardlessCustomers', () => {
  it('maps the export onto the takeover payload', () => {
    const rows = mapGoCardlessCustomers(customers());

    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      id: 'CU0001',
      email: 'sarah.hartley@example.co.uk',
      given_name: 'Sarah',
      family_name: 'Hartley',
      company_name: undefined,
      phone_number: '07700 900123',
      address_line1: '14 Meadow Lane',
      address_line2: undefined,
      city: 'Leeds',
      postal_code: 'LS6 3AB',
      created_at: '2023-09-04T09:12:44.000Z',
    });
  });

  it('lowercases the email so family matching is case-insensitive', () => {
    const raw = parseCsvText('id,email,given_name\nCU0009,Sarah.Hartley@Example.co.uk,Sarah\n');

    expect(mapGoCardlessCustomers(raw)[0].email).toBe('sarah.hartley@example.co.uk');
  });

  it('leaves a customer with no email for the server to report', () => {
    const rows = mapGoCardlessCustomers(customers());
    const noEmail = rows.find((row) => row.id === 'CU0004');

    expect(noEmail?.email).toBeUndefined();
  });

  it('drops a row with no GoCardless id, which can own no mandate', () => {
    const raw = parseCsvText('id,email\n,orphan@example.co.uk\nCU0010,real@example.co.uk\n');

    expect(mapGoCardlessCustomers(raw).map((row) => row.id)).toEqual(['CU0010']);
  });
});

describe('mapGoCardlessMandates', () => {
  it('maps the export onto the takeover payload', () => {
    const rows = mapGoCardlessMandates(mandates());

    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      id: 'MD0001',
      customer: 'CU0001',
      status: 'active',
      scheme: 'bacs',
      reference: 'CLUB-0001',
      created_at: '2023-09-04T09:13:02.000Z',
    });
  });

  it('passes the GoCardless status through untranslated for the server to map', () => {
    const statuses = mapGoCardlessMandates(mandates()).map((row) => row.status);

    expect(statuses).toContain('submitted');
    expect(statuses).toContain('cancelled');
  });

  it('drops a row the endpoint would reject, so one bad row cannot fail the batch', () => {
    const raw = parseCsvText(
      'id,customer,status\nMD0100,CU0001,active\nMD0101,,active\n,CU0001,active\nMD0102,CU0001,\n'
    );

    expect(mapGoCardlessMandates(raw).map((row) => row.id)).toEqual(['MD0100']);
  });

  it('maps a spreadsheet whose columns have been renamed', () => {
    const raw = parseCsvText(
      'Mandate ID,Customer ID,Mandate Status,Scheme,Reference\nMD0200,CU0200,active,bacs,CLUB-0200\n'
    );

    expect(mapGoCardlessMandates(raw)[0]).toMatchObject({
      id: 'MD0200',
      customer: 'CU0200',
      status: 'active',
      scheme: 'bacs',
    });
  });
});

describe('mapGoCardlessPayments', () => {
  it('maps the export onto the takeover payload', () => {
    const rows = mapGoCardlessPayments(payments());

    expect(rows).toHaveLength(4);
    expect(rows[0]).toEqual({
      id: 'PM0001',
      mandate: 'MD0001',
      amount: '32.50',
      currency: 'GBP',
      status: 'paid_out',
      charge_date: '2024-08-01',
      description: 'Monthly gymnastics fees',
    });
  });

  it('strips a currency symbol and thousands separator from the amount', () => {
    const raw = parseCsvText('id,mandate,amount,currency\nPM0100,MD0001,"£1,234.50",GBP\n');

    expect(mapGoCardlessPayments(raw)[0].amount).toBe('1234.50');
  });
});
