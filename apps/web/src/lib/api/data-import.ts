import { api } from './api-client';

/**
 * A single member row sent to the bulk member import endpoint.
 * Dates must already be normalised to YYYY-MM-DD and gender to M or F.
 */
export interface MemberImportRow {
  swimmer_first_name: string;
  swimmer_last_name: string;
  dob: string;
  gender: string;
  se_number?: string;
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
  swimmers_to_create: number;
  swimmers_to_update: number;
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
  swimmers_created: number;
  swimmers_updated: number;
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
  options: MemberImportOptions,
): Promise<MemberImportPreviewResponse> {
  return api.post<MemberImportPreviewResponse>('/import/members?preview=true', {
    rows,
    options,
  });
}

/**
 * Real import: creates or updates families, swimmers and (optionally) squads.
 */
export async function importMembers(
  rows: MemberImportRow[],
  options: MemberImportOptions,
): Promise<MemberImportResponse> {
  return api.post<MemberImportResponse>('/import/members?preview=false', {
    rows,
    options,
  });
}
