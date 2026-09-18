export type NotificationSource = 'session_cancellation' | 'broadcast';
export type DeliveryStatus =
  | 'queued'
  | 'sending'
  | 'provider_accepted'
  | 'delivered'
  | 'failed'
  | 'suppressed';
export interface Delivery {
  delivery_id: string;
  club_id: string;
  source_type: NotificationSource;
  source_id: string;
  event_key: string;
  kind: string;
  recipient_name: string;
  recipient_email: string | null;
  recipient_user_id: string | null;
  family_id: string | null;
  subject: string;
  body: string;
  status: DeliveryStatus;
  attempts: number;
  available_at: Date;
  first_attempt_at: Date | null;
  lease_token: string;
  last_error: string | null;
  sent_at: Date | null;
  follow_up_note: string | null;
  followed_up_at: Date | null;
}
export type NewDelivery = Pick<
  Delivery,
  | 'club_id'
  | 'source_type'
  | 'source_id'
  | 'event_key'
  | 'kind'
  | 'recipient_name'
  | 'subject'
  | 'body'
> &
  Partial<
    Pick<
      Delivery,
      'recipient_email' | 'recipient_user_id' | 'family_id' | 'available_at' | 'last_error'
    >
  >;
export const SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 8;
export function mayRetry(row: Pick<Delivery, 'first_attempt_at'>, now = Date.now()): boolean {
  return (
    !row.first_attempt_at || now - new Date(row.first_attempt_at).getTime() < SAFE_RETRY_WINDOW_MS
  );
}
