import { Family } from '../../modules/families/entities/family.entity';

let counter = 0;

export function buildFamily(overrides?: Partial<Family>): Family {
  counter += 1;
  const now = new Date();

  const defaults: Family = {
    family_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    family_name: `TestFamily${counter}`,
    primary_contact_name: `Parent ${counter}`,
    primary_contact_email: `parent${counter}@example.co.uk`,
    primary_contact_phone: '07700 900000',
    address_line1: '10 High Street',
    address_line2: null,
    city: 'Bristol',
    postcode: 'BS1 1AA',
    invite_token: null,
    invite_status: null,
    invited_at: null,
    invite_accepted_at: null,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
