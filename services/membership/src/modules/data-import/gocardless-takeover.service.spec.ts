import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { GoCardlessTakeoverService } from './gocardless-takeover.service';
import { FamiliesRepository } from '../families/families.repository';
import { MandatesRepository } from '../finance/mandates/mandates.repository';
import { DirectDebitMandateStatus } from '../finance/mandates/entities/direct-debit-mandate.entity';
import { ImportGoCardlessDto } from './dto/import-gocardless.dto';
import {
  GoCardlessCustomerRowDto,
  GoCardlessMandateRowDto,
  GoCardlessPaymentRowDto,
} from './dto/gocardless-import-row.dto';

/**
 * Fixture provenance: the three CSVs under __fixtures__ reproduce the column
 * layout of a club's own GoCardless dashboard exports (customers, mandates,
 * payments). docs/04-Incumbent-Landscape-Pricing-and-Exports.md records that
 * "DIY tooling (GoCardless + spreadsheet)" is the most common "system" on the
 * founding-club shortlist, which is why this is importer number one; the
 * takeover is built on those CSV exports rather than the GoCardless API
 * because Partner OAuth is not available to this platform yet.
 *
 * Names and addresses are invented, matching the sample rows already used in
 * the members import template.
 */

/** Minimal quote-aware CSV reader, for fixtures only. */
function readFixtureCsv(fileName: string): Record<string, string>[] {
  const text = readFileSync(join(__dirname, '__fixtures__', fileName), 'utf8').replace(/^﻿/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  };

  const headers = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      record[header] = cells[i] ?? '';
    });
    return record;
  });
}

const optional = (value: string | undefined) => (value ? value : undefined);

function fixtureCustomers(): GoCardlessCustomerRowDto[] {
  return readFixtureCsv('gocardless-customers.csv').map((raw) => ({
    id: raw.id,
    email: optional(raw.email),
    given_name: optional(raw.given_name),
    family_name: optional(raw.family_name),
    company_name: optional(raw.company_name),
    phone_number: optional(raw.phone_number),
    address_line1: optional(raw.address_line1),
    address_line2: optional(raw.address_line2),
    city: optional(raw.city),
    postal_code: optional(raw.postal_code),
    created_at: optional(raw.created_at),
  }));
}

function fixtureMandates(): GoCardlessMandateRowDto[] {
  return readFixtureCsv('gocardless-mandates.csv').map((raw) => ({
    id: raw.id,
    customer: raw.customer,
    status: raw.status,
    scheme: optional(raw.scheme),
    reference: optional(raw.reference),
    created_at: optional(raw.created_at),
  }));
}

function fixturePayments(): GoCardlessPaymentRowDto[] {
  return readFixtureCsv('gocardless-payments.csv').map((raw) => ({
    id: raw.id,
    mandate: optional(raw.mandate),
    amount: optional(raw.amount),
    currency: optional(raw.currency),
    status: optional(raw.status),
    charge_date: optional(raw.charge_date),
    description: optional(raw.description),
  }));
}

describe('GoCardlessTakeoverService', () => {
  let service: GoCardlessTakeoverService;

  const mockFamiliesRepository = {
    findByPrimaryContactEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockMandatesRepository = {
    findByFamily: jest.fn(),
    create: jest.fn(),
  };

  const makeDto = (
    overrides: Partial<ImportGoCardlessDto> = {},
    createMissingFamilies = true,
  ): ImportGoCardlessDto => ({
    customers: fixtureCustomers(),
    mandates: fixtureMandates(),
    payments: fixturePayments(),
    options: { create_missing_families: createMissingFamilies },
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoCardlessTakeoverService,
        { provide: FamiliesRepository, useValue: mockFamiliesRepository },
        { provide: MandatesRepository, useValue: mockMandatesRepository },
      ],
    }).compile();

    service = module.get<GoCardlessTakeoverService>(GoCardlessTakeoverService);

    mockFamiliesRepository.findByPrimaryContactEmail.mockResolvedValue(null);
    mockFamiliesRepository.create.mockImplementation((dto: { primary_contact_email: string }) =>
      Promise.resolve({ family_id: `family-for-${dto.primary_contact_email}` }),
    );
    mockMandatesRepository.findByFamily.mockResolvedValue([]);
    mockMandatesRepository.create.mockResolvedValue({ mandate_id: 'new-mandate-1' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('preview', () => {
    it('plans a whole club export from the three dashboard CSVs', async () => {
      const result = await service.previewGoCardless(makeDto());

      expect(result.summary.families_to_create).toBe(3);
      expect(result.summary.families_matched).toBe(0);
      // MD0001, MD0002, MD0003 and the cancelled MD0004.
      expect(result.summary.mandates_to_create).toBe(4);
      expect(result.summary.active_mandates_to_create).toBe(2);
      // MD0005: a second active mandate for the Hartley family.
      expect(result.summary.mandates_skipped).toBe(1);
      // MD0006 (customer with no email), MD0007 (unknown status), MD0008
      // (customer missing from the customers export).
      expect(result.summary.mandates_with_errors).toBe(3);
      expect(result.summary.customers_with_errors).toBe(1);
    });

    it('writes nothing', async () => {
      await service.previewGoCardless(makeDto());

      expect(mockFamiliesRepository.create).not.toHaveBeenCalled();
      expect(mockMandatesRepository.create).not.toHaveBeenCalled();
    });

    it('maps GoCardless statuses the same way MandatesService.syncMandateStatus does', async () => {
      const result = await service.previewGoCardless(makeDto());
      const byMandate = new Map(result.mandate_results.map((r) => [r.gocardless_mandate_id, r]));

      expect(byMandate.get('MD0001')?.status).toBe(DirectDebitMandateStatus.ACTIVE);
      // "submitted" is not yet collectable, so it lands on PENDING exactly as a
      // status sync would set it. Importing it as ACTIVE would be a lie that
      // the next sync immediately corrected.
      expect(byMandate.get('MD0003')?.status).toBe(DirectDebitMandateStatus.PENDING);
      expect(byMandate.get('MD0004')?.status).toBe(DirectDebitMandateStatus.CANCELLED);
    });

    it('reports an unrecognised GoCardless status as a row error rather than guessing', async () => {
      const result = await service.previewGoCardless(makeDto());
      const shredded = result.mandate_results.find((r) => r.gocardless_mandate_id === 'MD0007');

      expect(shredded?.action).toBe('error');
      expect(shredded?.status).toBeNull();
      expect(shredded?.errors[0]).toContain('unrecognised GoCardless status');
    });

    it('skips a family second active mandate with a per-row warning', async () => {
      const result = await service.previewGoCardless(makeDto());
      const second = result.mandate_results.find((r) => r.gocardless_mandate_id === 'MD0005');

      expect(second?.action).toBe('skip');
      expect(second?.warnings[0]).toContain('already has an active mandate');
    });

    it('still imports a cancelled mandate alongside an active one for the same family', async () => {
      const result = await service.previewGoCardless(makeDto());
      const cancelled = result.mandate_results.find((r) => r.gocardless_mandate_id === 'MD0004');

      expect(cancelled?.action).toBe('create');
    });

    it('matches an existing family by customer email instead of creating one', async () => {
      mockFamiliesRepository.findByPrimaryContactEmail.mockImplementation((email: string) =>
        Promise.resolve(
          email === 'sarah.hartley@example.co.uk'
            ? {
                family_id: 'family-1',
                family_name: 'Hartley',
                primary_contact_email: 'sarah.hartley@example.co.uk',
              }
            : null,
        ),
      );

      const result = await service.previewGoCardless(makeDto());

      expect(result.summary.families_matched).toBe(1);
      expect(result.summary.families_to_create).toBe(2);
      expect(result.customer_results[0].action).toBe('match');
    });

    it('matches families case-insensitively on the customer email', async () => {
      const customers = fixtureCustomers();
      customers[0].email = 'Sarah.Hartley@Example.co.uk';

      await service.previewGoCardless(makeDto({ customers }));

      expect(mockFamiliesRepository.findByPrimaryContactEmail).toHaveBeenCalledWith(
        'sarah.hartley@example.co.uk',
      );
    });

    it('skips a mandate whose provider id this club has already imported', async () => {
      mockFamiliesRepository.findByPrimaryContactEmail.mockImplementation((email: string) =>
        Promise.resolve(
          email === 'd.rhysjones@example.co.uk'
            ? {
                family_id: 'family-2',
                family_name: 'Rhys-Jones',
                primary_contact_email: 'd.rhysjones@example.co.uk',
              }
            : null,
        ),
      );
      mockMandatesRepository.findByFamily.mockResolvedValue([
        {
          provider: 'gocardless',
          provider_mandate_id: 'MD0002',
          status: DirectDebitMandateStatus.ACTIVE,
        },
      ]);

      const result = await service.previewGoCardless(makeDto());
      const alreadyImported = result.mandate_results.find(
        (r) => r.gocardless_mandate_id === 'MD0002',
      );

      expect(alreadyImported?.action).toBe('skip');
      expect(alreadyImported?.warnings[0]).toContain('already been imported');
    });

    it('skips a duplicated mandate row rather than tripping the provider unique constraint', async () => {
      const mandates = fixtureMandates();
      mandates.push({ ...mandates[0] });

      const result = await service.previewGoCardless(makeDto({ mandates }));
      const duplicate = result.mandate_results[result.mandate_results.length - 1];

      expect(duplicate.action).toBe('skip');
      expect(duplicate.warnings[0]).toContain('appears more than once');
    });

    it('reports a customer with no email rather than inventing a family', async () => {
      const result = await service.previewGoCardless(makeDto());
      const noEmail = result.customer_results.find((r) => r.gocardless_customer_id === 'CU0004');

      expect(noEmail?.action).toBe('error');
      expect(noEmail?.errors[0]).toContain('no email address');
    });

    it('skips unmatched customers when create_missing_families is off', async () => {
      const result = await service.previewGoCardless(makeDto({}, false));

      expect(result.summary.families_to_create).toBe(0);
      expect(result.summary.mandates_to_create).toBe(0);
      expect(result.customer_results[0].action).toBe('skip');
      expect(result.customer_results[0].errors[0]).toContain(
        'creating missing families is disabled',
      );
    });

    it('summarises payments for reconciliation without importing any', async () => {
      const result = await service.previewGoCardless(makeDto());

      expect(result.summary.payments).toEqual({
        rows: 4,
        rows_without_matching_mandate: 1,
        totals_by_currency: [{ currency: 'GBP', rows: 4, total_amount: 137 }],
        earliest_charge_date: '2024-08-01',
        latest_charge_date: '2024-09-02',
        imported: false,
      });
    });

    it('omits the payments summary when no payments file is supplied', async () => {
      const result = await service.previewGoCardless(makeDto({ payments: undefined }));

      expect(result.summary.payments).toBeNull();
    });
  });

  describe('import', () => {
    it('creates families and mandates matching what the preview planned', async () => {
      const dto = makeDto();
      const preview = await service.previewGoCardless(dto);
      const outcome = await service.importGoCardless(dto);

      expect(outcome.summary.families_created).toBe(preview.summary.families_to_create);
      expect(outcome.summary.mandates_created).toBe(preview.summary.mandates_to_create);
      expect(outcome.summary.active_mandates_created).toBe(
        preview.summary.active_mandates_to_create,
      );
      expect(outcome.summary.mandates_skipped).toBe(preview.summary.mandates_skipped);
      expect(mockMandatesRepository.create).toHaveBeenCalledTimes(4);
    });

    it('never writes payment history', async () => {
      const outcome = await service.importGoCardless(makeDto());

      expect(outcome.summary.payments_imported).toBe(0);
    });

    it('attaches every mandate for one customer to the same family', async () => {
      await service.importGoCardless(makeDto());

      const hartleyMandates = mockMandatesRepository.create.mock.calls
        .map((call) => call[0])
        .filter((row) => row.provider_customer_id === 'CU0001');

      expect(hartleyMandates).toHaveLength(2);
      expect(new Set(hartleyMandates.map((row) => row.family_id)).size).toBe(1);
    });

    it('reuses one family for two GoCardless customers sharing an email address', async () => {
      const customers = fixtureCustomers();
      customers[1].email = 'sarah.hartley@example.co.uk';

      await service.importGoCardless(makeDto({ customers }));

      expect(mockFamiliesRepository.create).toHaveBeenCalledTimes(2);
    });

    it('records a per-row error and carries on when one mandate insert fails', async () => {
      mockMandatesRepository.create
        .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))
        .mockResolvedValue({ mandate_id: 'new-mandate-2' });

      const outcome = await service.importGoCardless(makeDto());

      expect(outcome.summary.mandates_created).toBe(3);
      expect(
        outcome.errors.some((e) => e.scope === 'mandate' && e.message.includes('duplicate key')),
      ).toBe(true);
    });

    it('reports every mandate of a family whose creation failed, without aborting', async () => {
      mockFamiliesRepository.create.mockRejectedValueOnce(new Error('family insert failed'));

      const outcome = await service.importGoCardless(makeDto());

      expect(outcome.summary.families_created).toBe(2);
      expect(outcome.errors.filter((e) => e.message === 'family insert failed')).toHaveLength(2);
    });

    it('writes nothing for a customer that could not be resolved', async () => {
      await service.importGoCardless(makeDto());

      const written = mockMandatesRepository.create.mock.calls.map((call) => call[0]);
      expect(written.some((row) => row.provider_customer_id === 'CU0004')).toBe(false);
      expect(written.some((row) => row.provider_mandate_id === 'MD0008')).toBe(false);
    });
  });

  describe('zero re-mandating', () => {
    /**
     * The point of the takeover: an imported active mandate must be usable by
     * the existing billing path without the parent signing anything again.
     * MandatesService.completeRedirectFlow is the only other writer of an
     * active mandate, so an imported row must carry the same fields with the
     * same shapes. Collecting against it still needs the club's own GoCardless
     * connection linked in settings; this moves the records, not the keys.
     */
    const COMPLETE_REDIRECT_FLOW_FIELDS = [
      'family_id',
      'provider',
      'provider_customer_id',
      'provider_mandate_id',
      'status',
      'scheme',
    ].sort();

    it('persists exactly the fields completeRedirectFlow persists', async () => {
      await service.importGoCardless(makeDto());

      const written = mockMandatesRepository.create.mock.calls.map((call) => call[0]);
      expect(written.length).toBeGreaterThan(0);
      for (const row of written) {
        expect(Object.keys(row).sort()).toEqual(COMPLETE_REDIRECT_FLOW_FIELDS);
      }
    });

    it('persists an active mandate that satisfies the same invariants', async () => {
      await service.importGoCardless(makeDto());

      const active = mockMandatesRepository.create.mock.calls
        .map((call) => call[0])
        .find((row) => row.provider_mandate_id === 'MD0001');

      expect(active).toEqual({
        family_id: 'family-for-sarah.hartley@example.co.uk',
        provider: 'gocardless',
        provider_customer_id: 'CU0001',
        provider_mandate_id: 'MD0001',
        status: DirectDebitMandateStatus.ACTIVE,
        scheme: 'bacs',
      });
    });

    it('never gives a family two active mandates', async () => {
      await service.importGoCardless(makeDto());

      const activeByFamily = new Map<string, number>();
      for (const row of mockMandatesRepository.create.mock.calls.map((call) => call[0])) {
        if (row.status !== DirectDebitMandateStatus.ACTIVE) continue;
        activeByFamily.set(row.family_id, (activeByFamily.get(row.family_id) ?? 0) + 1);
      }

      for (const count of activeByFamily.values()) {
        expect(count).toBe(1);
      }
    });

    it('does not add an active mandate to a family that already has one', async () => {
      mockFamiliesRepository.findByPrimaryContactEmail.mockImplementation((email: string) =>
        Promise.resolve(
          email === 'sarah.hartley@example.co.uk'
            ? {
                family_id: 'family-1',
                family_name: 'Hartley',
                primary_contact_email: 'sarah.hartley@example.co.uk',
              }
            : null,
        ),
      );
      mockMandatesRepository.findByFamily.mockResolvedValue([
        {
          provider: 'gocardless',
          provider_mandate_id: 'MD9999',
          status: DirectDebitMandateStatus.ACTIVE,
        },
      ]);

      await service.importGoCardless(makeDto());

      const written = mockMandatesRepository.create.mock.calls.map((call) => call[0]);
      expect(written.some((row) => row.provider_mandate_id === 'MD0001')).toBe(false);
      // The cancelled mandate for the same family is still safe to import.
      expect(written.some((row) => row.provider_mandate_id === 'MD0004')).toBe(true);
    });

    it('lowercases a scheme from the export and falls back to bacs', async () => {
      const mandates = fixtureMandates();
      mandates[0].scheme = 'BACS';
      mandates[1].scheme = undefined;

      await service.importGoCardless(makeDto({ mandates }));

      const written = mockMandatesRepository.create.mock.calls.map((call) => call[0]);
      expect(written.find((row) => row.provider_mandate_id === 'MD0001')?.scheme).toBe('bacs');
      expect(written.find((row) => row.provider_mandate_id === 'MD0002')?.scheme).toBe('bacs');
    });
  });

  describe('family details', () => {
    it('builds the family from the GoCardless customer name and address', async () => {
      await service.importGoCardless(makeDto());

      expect(mockFamiliesRepository.create).toHaveBeenCalledWith({
        family_name: 'Hartley',
        primary_contact_name: 'Sarah Hartley',
        primary_contact_email: 'sarah.hartley@example.co.uk',
        primary_contact_phone: '07700 900123',
        address_line1: '14 Meadow Lane',
        address_line2: undefined,
        city: 'Leeds',
        postcode: 'LS6 3AB',
      });
    });

    it('falls back to the company name when the customer is an organisation', async () => {
      const customers = fixtureCustomers();
      customers[0].given_name = undefined;
      customers[0].family_name = undefined;
      customers[0].company_name = 'Meadow Lane Sports Trust';

      await service.importGoCardless(makeDto({ customers }));

      expect(mockFamiliesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          family_name: 'Meadow Lane Sports Trust',
          primary_contact_name: 'Meadow Lane Sports Trust',
        }),
      );
    });
  });
});
