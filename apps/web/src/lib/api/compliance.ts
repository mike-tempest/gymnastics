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

export interface SwimmerConsent {
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

export interface ComplianceSummary {
  healthScore: number;
  totalMembers: number;
  dbsValid: number;
  dbsExpiringSoon: number;
  dbsExpired: number;
  consentComplete: number;
  consentPartial: number;
  consentMissing: number;
  safeguardingOfficer: {
    name: string;
    role: string;
    email: string;
    phone: string;
    dbsNumber: string;
    dbsExpiry: string;
  } | null;
  expiringDbsChecks: {
    name: string;
    role: string;
    expiryDate: string;
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

export async function getConsentData(): Promise<SwimmerConsent[]> {
  return api.get<SwimmerConsent[]>('/compliance/consents', { cache: 'no-store' });
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
