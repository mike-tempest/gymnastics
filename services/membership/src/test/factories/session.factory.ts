import { Session, SessionStatus } from '../../modules/sessions/entities/session.entity';

let counter = 0;

export function buildSession(overrides?: Partial<Session>): Session {
  counter += 1;
  const now = new Date();

  const defaults: Session = {
    session_id: crypto.randomUUID(),
    club_id: crypto.randomUUID(),
    squad_id: crypto.randomUUID(),
    session_name: `Training Session ${counter}`,
    session_date: new Date('2026-04-14'),
    start_time: '18:00',
    end_time: '19:00',
    location: 'Main Pool',
    description: null,
    coach_name: `Coach ${counter}`,
    max_participants: 24,
    status: SessionStatus.SCHEDULED,
    created_at: now,
    updated_at: now,
  };

  return { ...defaults, ...overrides };
}
