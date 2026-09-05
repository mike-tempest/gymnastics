import { Squad } from '../../modules/squads/entities/squad.entity';

let counter = 0;

export function buildSquad(overrides?: Partial<Squad>): Squad {
  counter += 1;
  const now = new Date();

  const defaults: Squad = {
    squad_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    squad_name: `Squad ${counter}`,
    description: `Training squad ${counter}`,
    min_age: 8,
    max_age: 12,
    coach_name: `Coach ${counter}`,
    training_times: 'Monday 18:00-19:00, Wednesday 18:00-19:00',
    max_capacity: 24,
    created_at: now,
    updated_at: now,
    members: [],
  };

  return { ...defaults, ...overrides };
}
