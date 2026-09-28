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
  next_level_id?: string | null;
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

/**
 * One badge on a scheme's ladder with where a single gymnast has got to on it.
 * Served pre-stitched by the parent portal's badges endpoint (TEM-21), so the
 * ladder needs no client-side joining of schemes against progress rows.
 */
export interface BadgeLadderLevel {
  criteria?: ParentSkill[];
  level_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  /** Null when this gymnast has not started the badge yet. */
  status: AwardProgressStatus | null;
  started_on: string | null;
  assessed_on: string | null;
  awarded_on: string | null;
}

/** One scheme as a ladder of badges for a single gymnast. */
export interface BadgeLadderScheme {
  scheme_id: string;
  name: string;
  description: string | null;
  levels: BadgeLadderLevel[];
  awarded_count: number;
  /** The lowest badge not yet awarded, or null once the ladder is complete. */
  current_level: BadgeLadderLevel | null;
  latest_award: BadgeLadderLevel | null;
}

/** Every scheme's ladder for one gymnast, plus the headline across them all. */
export interface BadgeLadder {
  schemes: BadgeLadderScheme[];
  total_awarded: number;
  latest_award: (BadgeLadderLevel & { scheme_name: string }) | null;
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
  request_key: string;
  fee_preview_hash?: string;
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

/**
 * Ids per request. Member ids are UUIDs, so a large club's whole roll in one
 * query string would exceed the server's header limit and fail the request
 * outright. Batching keeps every URL comfortably short.
 */
const PROGRESS_BATCH_SIZE = 100;

export async function getProgressForMembers(memberIds: string[]): Promise<MemberAwardProgress[]> {
  if (memberIds.length === 0) return [];

  const batches: string[][] = [];
  for (let index = 0; index < memberIds.length; index += PROGRESS_BATCH_SIZE) {
    batches.push(memberIds.slice(index, index + PROGRESS_BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      api.get<MemberAwardProgress[]>(`/awards/progress?member_ids=${batch.join(',')}`, {
        cache: 'no-store',
      })
    )
  );

  return results.flat();
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

export interface SkillCriterion {
  criterion_id: string;
  level_id: string;
  name: string;
  guidance: string | null;
  sort_order: number;
  required: boolean;
  active: boolean;
  version: number;
}
export interface ParentSkill {
  criterion_id: string;
  name: string;
  guidance: string | null;
  required: boolean;
  active: boolean;
  status: 'working_towards' | 'achieved' | null;
  assessed_on: string | null;
  parent_note: string | null;
}
export interface SkillContext {
  level_progress?: {
    member_id: string;
    status: AwardProgressStatus;
    awarded_on: string | null;
    has_invoice: boolean;
  }[];
  level: AwardLevel;
  session: { session_id: string; session_date: string; status: string } | null;
  members: { member_id: string; first_name: string; last_name: string }[];
  criteria: SkillCriterion[];
  progress: {
    member_id: string;
    criterion_id: string;
    status: 'working_towards' | 'achieved';
    version: number;
    parent_note: string | null;
  }[];
}
export interface FeePreview {
  hash: string;
  currency: string;
  rows: {
    member_id: string;
    member_name: string;
    family_name: string | null;
    family_id: string | null;
    total_amount: number;
    tax_amount: number;
    reason: string | null;
  }[];
}
export const getSkillContext = (level: string, session?: string, squad?: string) =>
  api.get<SkillContext>(
    `/awards/skills/context?${new URLSearchParams({ level_id: level, ...(session ? { session_id: session } : squad ? { squad_id: squad } : {}) })}`,
    { cache: 'no-store' }
  );
export const previewAwardFees = (level: string, members: string[]) =>
  api.post<FeePreview>('/awards/fees/preview', { level_id: level, member_ids: members });
export const saveSkillAssessment = (data: unknown) =>
  api.post<{ recorded: number }>('/awards/skills/assessments', data);
export const getCriteria = (level: string) =>
  api.get<SkillCriterion[]>(`/awards/levels/${level}/criteria`, { cache: 'no-store' });
export const createCriterion = (level: string, data: unknown) =>
  api.post<SkillCriterion>(`/awards/levels/${level}/criteria`, data);
export const updateCriterion = (id: string, data: unknown) =>
  api.patch<SkillCriterion>(`/awards/criteria/${id}`, data);
export const setNextLevel = (id: string, next: string | null) =>
  api.patch(`/awards/levels/${id}/progression`, { next_level_id: next });
export const getSkillHistory = (member: string, level: string) =>
  api.get<
    {
      assessment_id: string;
      criterion_name: string;
      assessor_name: string;
      status: string;
      assessed_on: string;
      internal_note: string | null;
      parent_note: string | null;
    }[]
  >(`/awards/skills/history/${member}/${level}`, { cache: 'no-store' });
