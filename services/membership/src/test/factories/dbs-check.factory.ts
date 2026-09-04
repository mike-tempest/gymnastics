import {
  DBSCheck,
  DBSCheckType,
  DBSStatus,
} from '../../modules/compliance/dbs/entities/dbs-check.entity';

let counter = 0;

export function buildDBSCheck(overrides?: Partial<DBSCheck>): DBSCheck {
  counter += 1;
  const now = new Date();

  const defaults: DBSCheck = {
    dbs_check_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    user: undefined as any,
    certificate_number: `DBS${String(counter).padStart(8, '0')}`,
    check_type: DBSCheckType.ENHANCED,
    status: DBSStatus.VALID,
    issue_date: new Date('2025-01-15'),
    expiry_date: new Date('2028-01-15'),
    last_verified_date: new Date('2025-01-15'),
    notes: null!,
    is_valid: true,
    uploaded_document_id: null!,
    created_at: now,
    updated_at: now,
    created_by_user_id: crypto.randomUUID(),
    verified_by_user_id: crypto.randomUUID(),
  };

  return { ...defaults, ...overrides };
}
