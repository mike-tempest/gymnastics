import { CredentialStatus, CredentialType } from '@club-manager/shared-types';

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

/**
 * Staff and gymnast credentials: first aid, coaching qualifications and
 * safeguarding training, with expiry dates the service watches (TEM-30).
 * Exactly one of user and member is set on any record.
 */
export interface CredentialRecord {
  credential_id: string;
  user_id: string | null;
  member_id: string | null;
  credential_type: CredentialType;
  title: string;
  issuing_body: string | null;
  reference_number: string | null;
  issue_date: string;
  expiry_date: string | null;
  status: CredentialStatus;
  document_reference: string | null;
  notes: string | null;
  user?: { user_id: string; first_name: string; last_name: string; email: string } | null;
  member?: { member_id: string; first_name: string; last_name: string } | null;
}

export interface CredentialStatistics {
  total: number;
  valid: number;
  expiringSoon: number;
  expired: number;
}

export interface CreateCredentialInput {
  user_id?: string;
  member_id?: string;
  credential_type: CredentialType;
  title: string;
  // Null clears the field; undefined leaves it untouched on an update.
  issuing_body?: string | null;
  reference_number?: string | null;
  issue_date: string;
  expiry_date?: string | null;
  document_reference?: string | null;
  notes?: string | null;
}

export async function getCredentials(): Promise<CredentialRecord[]> {
  return api.get<CredentialRecord[]>('/compliance/credentials', { cache: 'no-store' });
}

export async function getCredentialStatistics(): Promise<CredentialStatistics> {
  return api.get<CredentialStatistics>('/compliance/credentials/statistics', {
    cache: 'no-store',
  });
}

export async function createCredential(input: CreateCredentialInput): Promise<CredentialRecord> {
  return api.post<CredentialRecord>('/compliance/credentials', input);
}

export async function updateCredential(
  id: string,
  input: Partial<CreateCredentialInput>
): Promise<CredentialRecord> {
  return api.put<CredentialRecord>(`/compliance/credentials/${id}`, input);
}

export async function deleteCredential(id: string): Promise<void> {
  await api.delete(`/compliance/credentials/${id}`);
}
