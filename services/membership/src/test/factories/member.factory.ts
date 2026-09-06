import { GoverningBody } from '@club-manager/shared-types';
import { Member } from '../../modules/members/entities/member.entity';

let counter = 0;

export function buildMember(overrides?: Partial<Member>): Member {
  counter += 1;
  const now = new Date();

  const defaults: Member = {
    member_id: crypto.randomUUID(),
    family_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    registration_number: `SE${String(counter).padStart(6, '0')}`,
    governing_body: GoverningBody.SWIM_ENGLAND,
    first_name: `Member`,
    last_name: `Test${counter}`,
    dob: new Date('2014-06-15'),
    gender: 'female',
    squad_id: crypto.randomUUID(),
    medical_notes: null,
    emergency_contact: null,
    photo_url: null,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
