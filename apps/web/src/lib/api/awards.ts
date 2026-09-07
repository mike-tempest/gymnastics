import { api } from './api-client';

/**
 * Badge and award-scheme API (TEM-18).
 *
 * Award schemes are data: British Gymnastics Rise, the legacy Proficiency
 * Awards and a club's own badges are all ordinary records, so everything here
 * is plain CRUD over those records rather than anything scheme-specific.
 */

export type AwardSchemeSource = 'bg-rise' | 'legacy-proficiency' | 'custom';
export type AwardProgressStatus = 'working_towards' | 'assessed' | 'awarded';
export type AssessmentOutcomeResult = 'awarded' | 'not_yet' | 'working_towards';

export interface AwardLevel {
  level_id: string;
  club_id: string;
  scheme_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  /** Decimal columns arrive as strings from the API. */
  badge_fee: number | string | null;
  certificate_fee: number | string | null;
  fee_structure_id: string | null;
  active: boolean;
}

export interface AwardScheme {
  scheme_id: string;
  club_id: string;
  name: string;
  description: string | null;
  source: AwardSchemeSource;
  active: boolean;
  levels: AwardLevel[];
}

export interface MemberAwardProgress {
  progress_id: string;
  member_id: string;
  level_id: string;
  status: AwardProgressStatus;
  started_on: string | null;
  assessed_on: string | null;
  awarded_on: string | null;
  notes: string | null;
  invoice_id: string | null;
  level?: AwardLevel & { scheme?: AwardScheme };
}

export interface CreateAwardSchemeInput {
  name: string;
  description?: string | null;
  source?: AwardSchemeSource;
  active?: boolean;
}

export type UpdateAwardSchemeInput = Partial<CreateAwardSchemeInput>;

export interface CreateAwardLevelInput {
  scheme_id: string;
  name: string;
  description?: string | null;
  sort_order?: number;
  badge_fee?: number | null;
  certificate_fee?: number | null;
  active?: boolean;
}

export type UpdateAwardLevelInput = Partial<Omit<CreateAwardLevelInput, 'scheme_id'>>;

export interface AssessmentOutcomeInput {
  member_id: string;
  outcome: AssessmentOutcomeResult;
  notes?: string | null;
}

export interface RecordAssessmentInput {
  level_id: string;
  assessed_at: string;
  notes?: string | null;
  bill_fees?: boolean;
  outcomes: AssessmentOutcomeInput[];
}

export interface AssessmentResult {
  awarded: number;
  invoices_raised: number;
  warnings: string[];
}

export interface InstallDefaultsResult {
  installed: string[];
  skipped: string[];
}

export interface RiseImportPreviewRow {
  row_number: number;
  first_name: string;
  last_name: string;
  dob: string;
  bg_membership_number: string;
  scheme: string;
  level: string;
  award_date: string;
  member_id: string | null;
  matched_on: 'registration_number' | 'name_and_dob' | null;
  level_id: string | null;
  errors: string[];
}

export interface RiseImportPreview {
  rows: RiseImportPreviewRow[];
  matched: number;
  unmatched: number;
  unknown_headers: string[];
  missing_headers: string[];
}

export interface RiseImportResult {
  imported: number;
  skipped: number;
  invoices_raised: number;
  warnings: string[];
}

// ==================== Schemes and levels ====================

export async function getAwardSchemes(includeInactive = false): Promise<AwardScheme[]> {
  const query = includeInactive ? '?include_inactive=true' : '';
  return api.get<AwardScheme[]>(`/awards/schemes${query}`, { cache: 'no-store' });
}

export async function getAwardScheme(schemeId: string): Promise<AwardScheme> {
  return api.get<AwardScheme>(`/awards/schemes/${schemeId}`, { cache: 'no-store' });
}

export async function createAwardScheme(data: CreateAwardSchemeInput): Promise<AwardScheme> {
  return api.post<AwardScheme>('/awards/schemes', data);
}

export async function updateAwardScheme(
  schemeId: string,
  data: UpdateAwardSchemeInput
): Promise<AwardScheme> {
  return api.patch<AwardScheme>(`/awards/schemes/${schemeId}`, data);
}

export async function deleteAwardScheme(schemeId: string): Promise<void> {
  return api.delete<void>(`/awards/schemes/${schemeId}`);
}

export async function installDefaultSchemes(): Promise<InstallDefaultsResult> {
  return api.post<InstallDefaultsResult>('/awards/schemes/install-defaults');
}

export async function createAwardLevel(data: CreateAwardLevelInput): Promise<AwardLevel> {
  return api.post<AwardLevel>('/awards/levels', data);
}

export async function updateAwardLevel(
  levelId: string,
  data: UpdateAwardLevelInput
): Promise<AwardLevel> {
  return api.patch<AwardLevel>(`/awards/levels/${levelId}`, data);
}

export async function deleteAwardLevel(levelId: string): Promise<void> {
  return api.delete<void>(`/awards/levels/${levelId}`);
}

// ==================== Progress and assessment ====================

export async function getMemberAwardProgress(memberId: string): Promise<MemberAwardProgress[]> {
  return api.get<MemberAwardProgress[]>(`/awards/member/${memberId}/progress`, {
    cache: 'no-store',
  });
}

export async function getProgressForMembers(memberIds: string[]): Promise<MemberAwardProgress[]> {
  if (memberIds.length === 0) return [];
  return api.get<MemberAwardProgress[]>(`/awards/progress?member_ids=${memberIds.join(',')}`, {
    cache: 'no-store',
  });
}

export async function recordAssessment(data: RecordAssessmentInput): Promise<AssessmentResult> {
  return api.post<AssessmentResult>('/awards/assessments', data);
}

// ==================== Rise CSV bridge ====================

export async function previewRiseImport(
  csv: string,
  schemeId?: string
): Promise<RiseImportPreview> {
  return api.post<RiseImportPreview>('/awards/import/rise/preview', {
    csv,
    ...(schemeId ? { scheme_id: schemeId } : {}),
  });
}

export async function importRiseCsv(
  csv: string,
  options: { schemeId?: string; billFees?: boolean } = {}
): Promise<RiseImportResult> {
  return api.post<RiseImportResult>('/awards/import/rise', {
    csv,
    ...(options.schemeId ? { scheme_id: options.schemeId } : {}),
    ...(options.billFees ? { bill_fees: true } : {}),
  });
}

/** Path of the Rise CSV export, for use with apiDownload. */
export function riseExportPath(schemeId?: string, includeAssessed = false): string {
  const params = new URLSearchParams();
  if (schemeId) params.set('scheme_id', schemeId);
  if (includeAssessed) params.set('include_assessed', 'true');
  const query = params.toString();
  return `/awards/export/rise.csv${query ? `?${query}` : ''}`;
}

/** Coerces a fee that may arrive as a decimal string into a number. */
export function feeAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
