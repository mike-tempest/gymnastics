import { api } from './api-client';

export interface DbsCheck {
  id: string;
  name: string;
  role: string;
  dbsNumber: string;
  checkDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
}

export interface MemberConsent {
  id: string;
  name: string;
  squad: string;
  medicalConsent: boolean;
  photoConsent: boolean;
  dataConsent: boolean;
  lastUpdated: string;
}

export interface ChecklistItem {
  id: string;
  requirement: string;
  description: string;
  completed: boolean;
}

export interface SafeguardingOfficer {
  name: string;
  role: string;
  email: string;
  phone: string;
  dbsNumber: string;
  dbsExpiry: string;
  qualifications: string;
}

export interface Incident {
  id: string;
  date: string;
  category: string;
  summary: string;
  status: 'open' | 'under review' | 'resolved';
  reportedBy: string;
}

/** State of an officer's own background check relative to today. */
export type CheckExpiryStatus = 'valid' | 'expiring' | 'expired' | 'unknown';

export interface SafeguardingOfficerSummary {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  dbsNumber: string;
  dbsExpiry: string;
  /** Days until the officer's own check expires; negative once it has. */
  daysRemaining: number | null;
  checkStatus: CheckExpiryStatus;
}

export interface ComplianceSummary {
  healthScore: number;
  /** Members in the club, counted from the member records themselves. */
  totalMembers: number;
  /** Background check records the club holds, whatever their state. */
  dbsChecks: number;
  dbsValid: number;
  dbsExpiringSoon: number;
  dbsExpired: number;
  /** Consent records the club holds, whatever their state. */
  consentRecords: number;
  /** Members holding every required consent, live and granted. */
  consentComplete: number;
  /** Members holding some but not all of the required consents. */
  consentPartial: number;
  /** Members with none of the required consents on file. */
  consentMissing: number;
  /** The first officer, for callers that only show one. */
  safeguardingOfficer: SafeguardingOfficerSummary | null;
  /** Every safeguarding officer the club has appointed. */
  safeguardingOfficers: SafeguardingOfficerSummary[];
  expiringDbsChecks: {
    name: string;
    role: string;
    expiryDate: string;
    /** Negative once the check has lapsed. */
    daysRemaining: number;
  }[];
}

export async function getDbsChecks(): Promise<DbsCheck[]> {
  return api.get<DbsCheck[]>('/compliance/dbs', { cache: 'no-store' });
}

export interface CreateDbsCheckInput {
  user_id: string;
  certificate_number: string;
  check_type: string;
  issue_date: string;
  expiry_date?: string;
  notes?: string;
}

export async function createDbsCheck(input: CreateDbsCheckInput): Promise<unknown> {
  return api.post('/compliance/dbs', input);
}

export interface CreateSafeguardingOfficerInput {
  name: string;
  role: string;
  email: string;
  phone?: string;
  dbs_number?: string;
  dbs_expiry?: string;
  qualifications?: string;
}

export async function createSafeguardingOfficer(
  input: CreateSafeguardingOfficerInput,
): Promise<unknown> {
  return api.post('/compliance/safeguarding/officers', input);
}

export async function getConsentData(): Promise<MemberConsent[]> {
  return api.get<MemberConsent[]>('/compliance/consents', { cache: 'no-store' });
}

export async function getChecklist(): Promise<ChecklistItem[]> {
  return api.get<ChecklistItem[]>('/compliance/safeguarding/checklist', { cache: 'no-store' });
}

export async function getSafeguardingOfficer(): Promise<SafeguardingOfficer | null> {
  const officers = await api.get<SafeguardingOfficer[]>('/compliance/safeguarding/officers', { cache: 'no-store' });
  return officers[0] ?? null;
}

export async function getIncidents(): Promise<Incident[]> {
  return api.get<Incident[]>('/compliance/safeguarding/incidents', { cache: 'no-store' });
}

export async function updateChecklistItem(
  id: string,
  completed: boolean,
): Promise<ChecklistItem> {
  return api.patch<ChecklistItem>(`/compliance/safeguarding/checklist/${id}`, { completed });
}

export async function getComplianceSummary(): Promise<ComplianceSummary | null> {
  return api.get<ComplianceSummary>('/compliance/summary', { cache: 'no-store' });
}
