import { api } from './api-client';

export interface WaitlistEntry {
  id: string;
  email: string;
  clubName: string | null;
  role: string | null;
  name: string | null;
  source: string;
  createdAt: string;
  confirmationSentAt: string | null;
  drip1SentAt: string | null;
  drip2SentAt: string | null;
  drip3SentAt: string | null;
}

export async function getWaitlistEntries(): Promise<WaitlistEntry[]> {
  return api.get<WaitlistEntry[]>('/waitlist', { cache: 'no-store' });
}

export async function getWaitlistCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>('/waitlist/count', { cache: 'no-store' });
}

export async function processWaitlistDrips(): Promise<{ sent: number }> {
  return api.post<{ sent: number }>('/waitlist/process-drips');
}
