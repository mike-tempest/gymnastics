import { User, UserRole } from '../../modules/users/entities/user.entity';

let counter = 0;

export function buildUser(overrides?: Partial<User>): User {
  counter += 1;
  const now = new Date();

  const defaults: User = {
    user_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    email: `user${counter}@example.co.uk`,
    password_hash: '$2b$10$testhashedpasswordplaceholder',
    first_name: `User`,
    last_name: `Test${counter}`,
    role: UserRole.PARENT,
    active: true,
    family_id: crypto.randomUUID(),
    last_login: null!,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
