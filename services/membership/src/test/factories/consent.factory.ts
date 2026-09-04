import {
  Consent,
  ConsentType,
  ConsentStatus,
} from '../../modules/compliance/consents/entities/consent.entity';

export function buildConsent(overrides?: Partial<Consent>): Consent {
  const now = new Date();

  const defaults: Consent = {
    consent_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    swimmer_id: crypto.randomUUID(),
    swimmer: undefined as any,
    consent_type: ConsentType.PHOTOGRAPHY,
    status: ConsentStatus.GRANTED,
    granted_by_user_id: crypto.randomUUID(),
    granted_by: undefined as any,
    granted_date: new Date('2026-01-01'),
    revoked_date: null!,
    revoked_by_user_id: null!,
    expiry_date: null!,
    notes: null!,
    specific_conditions: null!,
    requires_annual_renewal: false,
    metadata: null!,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
