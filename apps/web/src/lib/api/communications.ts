import { api } from './api-client';

export interface Communication {
  communication_id: string;
  subject: string;
  body: string;
  recipient_type: 'ALL' | 'SQUAD' | 'FAMILY';
  squad_id: string | null;
  family_id: string | null;
  recipient_count: number;
  sent_date: string;
  created_at: string;
  squad?: { squad_id: string; squad_name: string };
  family?: { family_id: string; family_name: string };
}

export interface SendMessageData {
  subject: string;
  body: string;
  recipientType: 'all' | 'squad' | 'family';
  squadId?: string;
  familyId?: string;
}

export async function getAnnouncements(): Promise<Communication[]> {
  try {
    return await api.get<Communication[]>('/communications', { cache: 'no-store' });
  } catch {
    return [];
  }
}

export async function getCommunication(id: string): Promise<Communication> {
  return api.get<Communication>(`/communications/${id}`, { cache: 'no-store' });
}

export async function sendMessage(data: SendMessageData): Promise<void> {
  return api.post<void>('/communications', data);
}
