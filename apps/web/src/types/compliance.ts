import { BackgroundCheckStatus, BackgroundCheckType } from '@club-manager/shared-types';

// Shared-types is the single source of truth for check enums; the DBS names
// are aliases kept so existing imports compile unchanged.
export { BackgroundCheckStatus, BackgroundCheckType };
export const DBSCheckType = BackgroundCheckType;
export type DBSCheckType = BackgroundCheckType;
export const DBSStatus = BackgroundCheckStatus;
export type DBSStatus = BackgroundCheckStatus;

export enum ConsentType {
  PHOTOGRAPHY = 'PHOTOGRAPHY',
  VIDEO = 'VIDEO',
  MEDICAL_TREATMENT = 'MEDICAL_TREATMENT',
  DATA_SHARING = 'DATA_SHARING',
  TRANSPORT = 'TRANSPORT',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  NEWSLETTER = 'NEWSLETTER',
  CONTACT = 'CONTACT',
}

export enum ConsentStatus {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  PENDING = 'PENDING',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export interface DBSCheck {
  dbs_check_id: string;
  user_id: string;
  certificate_number: string;
  check_type: DBSCheckType;
  status: DBSStatus;
  issue_date: string;
  expiry_date: string;
  last_verified_date?: string;
  notes?: string;
  is_valid: boolean;
  uploaded_document_id?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string;
  verified_by_user_id?: string;
  user?: {
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface Consent {
  consent_id: string;
  swimmer_id: string;
  consent_type: ConsentType;
  status: ConsentStatus;
  granted_by_user_id: string;
  granted_date: string;
  revoked_date?: string;
  revoked_by_user_id?: string;
  expiry_date?: string;
  notes?: string;
  specific_conditions?: string;
  requires_annual_renewal: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  swimmer?: {
    swimmer_id: string;
    first_name: string;
    last_name: string;
  };
  granted_by?: {
    user_id: string;
    first_name: string;
    last_name: string;
  };
}

export interface DBSStatistics {
  total: number;
  valid: number;
  expiring_soon: number;
  expired: number;
  pending: number;
  rejected: number;
}

export interface ConsentStatistics {
  total: number;
  granted: number;
  denied: number;
  pending: number;
  revoked: number;
  expired: number;
  by_type: Record<ConsentType, number>;
}

export interface ComplianceHealthScore {
  overall_score: number;
  dbs_compliance: {
    score: number;
    weight: number;
    total_staff: number;
    valid_dbs: number;
  };
  consent_coverage: {
    score: number;
    weight: number;
    total_swimmers: number;
    fully_consented: number;
  };
  safeguarding_officers: {
    score: number;
    weight: number;
    required: number;
    qualified: number;
  };
  incident_log: {
    score: number;
    weight: number;
    last_review_date?: string;
  };
  action_items: string[];
}
