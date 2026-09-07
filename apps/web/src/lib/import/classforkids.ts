/**
 * ClassForKids mapper.
 *
 * ClassForKids publishes no customer or family export and no API
 * (docs/04-Incumbent-Landscape-Pricing-and-Exports.md, section 1). A club
 * leaving it has only the per-screen spreadsheets it can download: a
 * Financial Summary or Analysis, an Outstanding report, contacts compiled
 * from the Schedule page, and per-class register downloads. So this mapper
 * takes several small files at once, pulls parent plus child plus class out
 * of whichever of them carry names, merges the same child across files, and
 * feeds the result into the ordinary members import.
 *
 * Two deliberate limits, both shown to the club in the preview:
 *   - Money columns feed nothing. There is no fee import yet, so amounts are
 *     totalled per file as context and never turned into data.
 *   - Card mandates are not portable. ClassForKids collects by recurring card
 *     through its own Stripe integration, so families set up a Direct Debit
 *     afresh here. That is the pitch, not a shortcoming of the import.
 */

import { parseDateOfBirth } from './date-of-birth';
import {
  type AutoMapField,
  type CanonicalImportField,
  autoMapHeaders,
  matchHeader,
  normaliseGender,
} from './header-mapping';
import type { ParsedSpreadsheet } from './spreadsheet';

/** What a given uploaded spreadsheet contributes to the import. */
export type ClassForKidsFileRole =
  /** Carries child names, so it contributes gymnast rows. */
  | 'people'
  /** Money only, e.g. a Financial Summary export: totals for context. */
  | 'financial'
  /** Nothing recognisable; ignored with a note. */
  | 'unknown';

/** The fields this mapper pulls out of a ClassForKids spreadsheet. */
export type ClassForKidsField =
  | 'member_first_name'
  | 'member_last_name'
  | 'member_full_name'
  | 'date_of_birth'
  | 'gender'
  | 'squad_name'
  | 'venue'
  | 'day'
  | 'parent_name'
  | 'parent_email'
  | 'parent_phone'
  | 'address_line1'
  | 'city'
  | 'postcode'
  | 'amount';

const CLASS_FOR_KIDS_FIELDS: readonly AutoMapField<ClassForKidsField>[] = [
  { key: 'member_first_name', canonical: 'first_name' },
  { key: 'member_last_name', canonical: 'last_name' },
  { key: 'member_full_name', canonical: 'member_full_name' },
  { key: 'date_of_birth', canonical: 'date_of_birth' },
  { key: 'gender', canonical: 'gender' },
  { key: 'squad_name', canonical: 'squad' },
  { key: 'venue', canonical: 'venue' },
  { key: 'day', canonical: 'day' },
  { key: 'parent_name', canonical: 'parent_name' },
  { key: 'parent_email', canonical: 'parent_email' },
  { key: 'parent_phone', canonical: 'parent_phone' },
  { key: 'address_line1', canonical: 'address_line1' },
  { key: 'city', canonical: 'city' },
  { key: 'postcode', canonical: 'postcode' },
  { key: 'amount', canonical: 'amount' },
];

/** Fields the members import endpoint refuses a row without. */
export const CLASS_FOR_KIDS_REQUIRED_FIELDS = [
  'member_first_name',
  'member_last_name',
  'date_of_birth',
  'gender',
  'parent_name',
  'parent_email',
] as const;

export interface ClassForKidsUpload {
  name: string;
  sheet: ParsedSpreadsheet;
}

export interface ClassForKidsRow {
  member_first_name: string;
  member_last_name: string;
  /** Normalised to YYYY-MM-DD, or empty when absent or unparseable. */
  date_of_birth: string;
  /** Normalised to M or F, or empty. */
  gender: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  squad_name: string;
  venue: string;
  day: string;
  address_line1: string;
  city: string;
  postcode: string;
  /** Further classes this child appears in, beyond squad_name. */
  additional_classes: string[];
  /** Names of the uploaded files this row was assembled from. */
  sources: string[];
  /** Required fields this row still lacks, so it cannot be imported yet. */
  missing: string[];
}

export interface ClassForKidsFileSummary {
  name: string;
  role: ClassForKidsFileRole;
  rowCount: number;
  /** Headers that were recognised, in file order. */
  mappedHeaders: string[];
  /** Headers that were not recognised and are ignored. */
  ignoredHeaders: string[];
  /** Gymnast rows this file contributed, before merging. */
  peopleRows: number;
}

export interface ClassForKidsAmountSummary {
  file: string;
  column: string;
  rows: number;
  total: number;
}

export interface ClassForKidsExtraction {
  files: ClassForKidsFileSummary[];
  rows: ClassForKidsRow[];
  /** Money columns, totalled per file. Informational only. */
  amounts: ClassForKidsAmountSummary[];
  /** How many raw rows collapsed onto an earlier row for the same child. */
  mergedRows: number;
}

/**
 * Split a single-cell name into first and last.
 * Handles "Jane Smith", "Smith, Jane" and the single-word case.
 */
export function splitFullName(value: string): { first: string; last: string } {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return { first: '', last: '' };

  const comma = cleaned.indexOf(',');
  if (comma > 0) {
    const last = cleaned.slice(0, comma).trim();
    const first = cleaned.slice(comma + 1).trim();
    if (first && last) return { first, last };
  }

  const parts = cleaned.split(' ');
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Decide what a spreadsheet contributes from its headers alone: a file with
 * a child-name column carries people, one with only money columns is a
 * financial export.
 */
export function detectClassForKidsFileRole(headers: readonly string[]): ClassForKidsFileRole {
  const canonicals = new Set<CanonicalImportField>();
  for (const header of headers) {
    const canonical = matchHeader(header);
    if (canonical) canonicals.add(canonical);
  }

  const hasName =
    canonicals.has('member_full_name') ||
    canonicals.has('first_name') ||
    canonicals.has('last_name');
  if (hasName) return 'people';
  if (canonicals.has('amount')) return 'financial';
  return 'unknown';
}

/** Normalise a value for use inside a merge key. */
function key(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

interface ClassForKidsIdentity {
  member_first_name: string;
  member_last_name: string;
  parent_email: string;
  parent_name: string;
}

/**
 * The identity two rows must share to be treated as the same gymnast.
 * Parent email is the strongest signal and matches how the members import
 * groups families; parent name is the fallback for files that carry no
 * email, which is common in ClassForKids register downloads.
 */
export function classForKidsRowKey(row: ClassForKidsIdentity): string {
  const parent = key(row.parent_email) || key(row.parent_name);
  return `${parent}|${key(row.member_first_name)}|${key(row.member_last_name)}`;
}

/**
 * Every key a row can be recognised by.
 *
 * A contacts export carries a parent email and a register download usually
 * does not, so keying on one or the other alone would leave the same child
 * appearing twice, which is exactly the merge this mapper exists to do. Each
 * row is therefore indexed under both its email key and its name key, and a
 * later row matches if either key has been seen.
 */
function classForKidsRowKeys(row: ClassForKidsIdentity): string[] {
  const child = `${key(row.member_first_name)}|${key(row.member_last_name)}`;
  const keys: string[] = [];
  if (key(row.parent_email)) keys.push(`${key(row.parent_email)}|${child}`);
  if (key(row.parent_name)) keys.push(`${key(row.parent_name)}|${child}`);
  // A file with neither a parent email nor a parent name still needs an
  // identity, so the child's own name has to carry it.
  if (keys.length === 0) keys.push(`|${child}`);
  return keys;
}

function parseAmount(value: string): number | null {
  // Strip currency symbols, thousands separators and a trailing credit sign.
  const cleaned = value.replace(/[£$€,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function missingFields(row: ClassForKidsRow): string[] {
  return CLASS_FOR_KIDS_REQUIRED_FIELDS.filter((field) => !row[field]);
}

/** Keep the value we already have; take the new one only when we have none. */
function fill(current: string, incoming: string): string {
  return current || incoming.trim();
}

/**
 * Pull gymnast rows and informational money totals out of several
 * ClassForKids spreadsheets, merging the same child across files.
 */
export function extractClassForKidsRows(
  uploads: readonly ClassForKidsUpload[]
): ClassForKidsExtraction {
  const files: ClassForKidsFileSummary[] = [];
  const amounts: ClassForKidsAmountSummary[] = [];
  // Several keys can point at the same row object, so the output order is
  // tracked separately rather than read off the index.
  const rowsByKey = new Map<string, ClassForKidsRow>();
  const extracted: ClassForKidsRow[] = [];
  let mergedRows = 0;

  /** Index a row under every key it can now be recognised by. */
  const indexRow = (row: ClassForKidsRow) => {
    for (const rowKey of classForKidsRowKeys(row)) {
      rowsByKey.set(rowKey, row);
    }
  };

  for (const upload of uploads) {
    const { headers, rows } = upload.sheet;
    const role = detectClassForKidsFileRole(headers);
    const mapping = autoMapHeaders(headers, CLASS_FOR_KIDS_FIELDS);
    const mappedHeaders = Object.values(mapping).filter(Boolean) as string[];
    const claimed = new Set(mappedHeaders);

    // Money totals, per file and per column. Every money-ish column counts,
    // not just the one autoMapHeaders claimed, because a Financial Analysis
    // sheet carries several at once.
    for (const header of headers) {
      if (matchHeader(header) !== 'amount') continue;
      let count = 0;
      let total = 0;
      for (const raw of rows) {
        const parsed = parseAmount(raw[header] ?? '');
        if (parsed === null) continue;
        count++;
        total += parsed;
      }
      if (count > 0) {
        amounts.push({
          file: upload.name,
          column: header,
          rows: count,
          total: Math.round(total * 100) / 100,
        });
      }
    }

    let peopleRows = 0;
    if (role === 'people') {
      for (const raw of rows) {
        const value = (field: ClassForKidsField): string => {
          const header = mapping[field];
          return header ? (raw[header] ?? '').trim() : '';
        };

        let first = value('member_first_name');
        let last = value('member_last_name');
        if (!first && !last) {
          const split = splitFullName(value('member_full_name'));
          first = split.first;
          last = split.last;
        }
        if (!first && !last) continue;

        const parentEmail = value('parent_email').toLowerCase();
        const parentName = value('parent_name');
        const squadName = value('squad_name');

        const identity = {
          member_first_name: first,
          member_last_name: last,
          parent_email: parentEmail,
          parent_name: parentName,
        };

        peopleRows++;

        const existing = classForKidsRowKeys(identity)
          .map((rowKey) => rowsByKey.get(rowKey))
          .find((candidate) => candidate !== undefined);
        if (existing) {
          mergedRows++;
          existing.member_first_name = fill(existing.member_first_name, first);
          existing.member_last_name = fill(existing.member_last_name, last);
          existing.date_of_birth =
            existing.date_of_birth || (parseDateOfBirth(value('date_of_birth')) ?? '');
          existing.gender = existing.gender || (normaliseGender(value('gender'), ['M', 'F']) ?? '');
          existing.parent_name = fill(existing.parent_name, parentName);
          existing.parent_email = fill(existing.parent_email, parentEmail);
          existing.parent_phone = fill(existing.parent_phone, value('parent_phone'));
          existing.venue = fill(existing.venue, value('venue'));
          existing.day = fill(existing.day, value('day'));
          existing.address_line1 = fill(existing.address_line1, value('address_line1'));
          existing.city = fill(existing.city, value('city'));
          existing.postcode = fill(existing.postcode, value('postcode'));
          if (squadName) {
            if (!existing.squad_name) {
              existing.squad_name = squadName;
            } else if (
              key(existing.squad_name) !== key(squadName) &&
              !existing.additional_classes.some((name) => key(name) === key(squadName))
            ) {
              // A child in two classes still becomes one gymnast in one
              // squad; the extra classes are reported rather than dropped.
              existing.additional_classes.push(squadName);
            }
          }
          if (!existing.sources.includes(upload.name)) {
            existing.sources.push(upload.name);
          }
          // The merged row may have gained an email or a parent name it did
          // not have before, so re-index it under its new keys too.
          indexRow(existing);
          continue;
        }

        const row: ClassForKidsRow = {
          member_first_name: first,
          member_last_name: last,
          date_of_birth: parseDateOfBirth(value('date_of_birth')) ?? '',
          gender: normaliseGender(value('gender'), ['M', 'F']) ?? '',
          parent_name: parentName,
          parent_email: parentEmail,
          parent_phone: value('parent_phone'),
          squad_name: squadName,
          venue: value('venue'),
          day: value('day'),
          address_line1: value('address_line1'),
          city: value('city'),
          postcode: value('postcode'),
          additional_classes: [],
          sources: [upload.name],
          missing: [],
        };
        extracted.push(row);
        indexRow(row);
      }
    }

    files.push({
      name: upload.name,
      role,
      rowCount: rows.length,
      mappedHeaders,
      ignoredHeaders: headers.filter((header) => !claimed.has(header)),
      peopleRows,
    });
  }

  for (const row of extracted) {
    row.missing = missingFields(row);
  }

  return { files, rows: extracted, amounts, mergedRows };
}
