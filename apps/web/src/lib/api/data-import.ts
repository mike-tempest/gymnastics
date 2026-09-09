import type {
  GoCardlessCustomerRow,
  GoCardlessMandateRow,
  GoCardlessPaymentRow,
} from '@/lib/import/gocardless';

import { api } from './api-client';

/**
 * A single member row sent to the bulk member import endpoint.
 * Dates must already be normalised to YYYY-MM-DD and gender to M or F.
 */
export interface MemberImportRow {
  member_first_name: string;
  member_last_name: string;
  dob: string;
  gender: string;
  registration_number?: string;
  governing_body?: string;
  squad_name?: string;
  medical_notes?: string;
  emergency_contact?: string;
  parent_name: string;
  parent_email: string;
  parent_phone?: string;
  family_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

export interface MemberImportOptions {
  create_missing_squads: boolean;
}

export interface MemberImportPreviewSummary {
  families_to_create: number;
  families_matched: number;
  members_to_create: number;
  members_to_update: number;
  squads_matched: string[];
  squads_missing: string[];
}

export interface MemberImportRowResult {
  row: number;
  action: 'create' | 'update' | 'error';
  family_action: 'create' | 'match';
  errors: string[];
}

export interface MemberImportPreviewResponse {
  summary: MemberImportPreviewSummary;
  row_results: MemberImportRowResult[];
}

export interface MemberImportResultSummary {
  families_created: number;
  members_created: number;
  members_updated: number;
}

export interface MemberImportError {
  row: number;
  message: string;
}

export interface MemberImportResponse {
  summary: MemberImportResultSummary;
  errors: MemberImportError[];
}

/**
 * Dry run: validates and matches rows server-side without writing anything.
 */
export async function previewMembersImport(
  rows: MemberImportRow[],
  options: MemberImportOptions
): Promise<MemberImportPreviewResponse> {
  return api.post<MemberImportPreviewResponse>('/import/members?preview=true', {
    rows,
    options,
  });
}

/**
 * Real import: creates or updates families, members and (optionally) squads.
 */
export async function importMembers(
  rows: MemberImportRow[],
  options: MemberImportOptions
): Promise<MemberImportResponse> {
  return api.post<MemberImportResponse>('/import/members?preview=false', {
    rows,
    options,
  });
}

// ---------------------------------------------------------------------------
// GoCardless organisation takeover
// ---------------------------------------------------------------------------

export interface GoCardlessImportOptions {
  create_missing_families: boolean;
}

export interface GoCardlessImportPayload {
  customers: GoCardlessCustomerRow[];
  mandates: GoCardlessMandateRow[];
  payments?: GoCardlessPaymentRow[];
}

export interface GoCardlessPaymentsSummary {
  rows: number;
  rows_without_matching_mandate: number;
  totals_by_currency: Array<{ currency: string; rows: number; total_amount: number }>;
  earliest_charge_date: string | null;
  latest_charge_date: string | null;
  /** Always false: payment history is a stated non-goal of the takeover. */
  imported: boolean;
}

export interface GoCardlessCustomerResult {
  row: number;
  gocardless_customer_id: string;
  email: string | null;
  action: 'create' | 'match' | 'skip' | 'error';
  errors: string[];
}

export interface GoCardlessMandateResult {
  row: number;
  gocardless_mandate_id: string;
  gocardless_customer_id: string;
  action: 'create' | 'skip' | 'error';
  status: 'pending' | 'active' | 'cancelled' | 'failed' | 'expired' | null;
  warnings: string[];
  errors: string[];
}

export interface GoCardlessPreviewResponse {
  summary: {
    families_to_create: number;
    families_matched: number;
    customers_with_errors: number;
    mandates_to_create: number;
    active_mandates_to_create: number;
    mandates_skipped: number;
    mandates_with_errors: number;
    payments: GoCardlessPaymentsSummary | null;
  };
  customer_results: GoCardlessCustomerResult[];
  mandate_results: GoCardlessMandateResult[];
}

export interface GoCardlessImportMessage {
  scope: 'customer' | 'mandate';
  row: number;
  message: string;
}

export interface GoCardlessImportResponse {
  summary: {
    families_created: number;
    families_matched: number;
    mandates_created: number;
    active_mandates_created: number;
    mandates_skipped: number;
    payments_imported: number;
  };
  errors: GoCardlessImportMessage[];
  warnings: GoCardlessImportMessage[];
}

/** Dry run of the takeover: matches and validates server-side, writes nothing. */
export async function previewGoCardlessImport(
  payload: GoCardlessImportPayload,
  options: GoCardlessImportOptions
): Promise<GoCardlessPreviewResponse> {
  return api.post<GoCardlessPreviewResponse>('/import/gocardless?preview=true', {
    ...payload,
    options,
  });
}

/** Real takeover: creates or matches families and writes their mandates. */
export async function importGoCardless(
  payload: GoCardlessImportPayload,
  options: GoCardlessImportOptions
): Promise<GoCardlessImportResponse> {
  return api.post<GoCardlessImportResponse>('/import/gocardless?preview=false', {
    ...payload,
    options,
  });
}
