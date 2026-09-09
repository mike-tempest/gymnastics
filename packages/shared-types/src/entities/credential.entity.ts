/**
 * Staff and gymnast credentials (TEM-30).
 *
 * Rule 2 of docs/05-Build-Brief-Positioning-and-Product-Rules.md: compliance
 * is a first-class module, not a notes field. A club has to be able to prove
 * that the coach on the floor holds a current first-aid certificate, a current
 * coaching qualification and current safeguarding training, and it has to be
 * told before any of them lapse. Background checks already have their own
 * module; everything else a club has to evidence lives here.
 *
 * The type is a plain string union rather than a Postgres enum, following the
 * governing_body precedent: a club that runs its own award or training scheme
 * should not need a migration to record it.
 */

/** What kind of credential a record evidences. */
export enum CredentialType {
  /** Emergency first aid, paediatric first aid, a sports first-aid course. */
  FIRST_AID = 'first_aid',
  /** A coaching award: UKCC levels, a BG discipline coaching qualification. */
  COACHING_QUALIFICATION = 'coaching_qualification',
  /** Safeguarding and protecting children training, and its refreshers. */
  SAFEGUARDING_TRAINING = 'safeguarding_training',
  /** Anything else the club has to evidence, named in the title field. */
  OTHER = 'other',
}

/** Display labels for each credential type. Sentence case, British English. */
export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  [CredentialType.FIRST_AID]: 'First aid',
  [CredentialType.COACHING_QUALIFICATION]: 'Coaching qualification',
  [CredentialType.SAFEGUARDING_TRAINING]: 'Safeguarding training',
  [CredentialType.OTHER]: 'Other',
};

/**
 * Where a credential has got to. Stored on the row rather than derived on
 * read, matching how the background-check module works, so a club can filter
 * and count without every query recomputing dates. The daily sweep keeps it
 * honest.
 */
export enum CredentialStatus {
  /** In date, or holds no expiry date at all. */
  VALID = 'valid',
  /** Expires within CREDENTIAL_EXPIRING_SOON_DAYS. */
  EXPIRING_SOON = 'expiring_soon',
  /** The expiry date has passed. */
  EXPIRED = 'expired',
}

/** Display labels for each status. */
export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  [CredentialStatus.VALID]: 'Valid',
  [CredentialStatus.EXPIRING_SOON]: 'Expiring soon',
  [CredentialStatus.EXPIRED]: 'Expired',
};

/** A credential counts as expiring soon this many days before it lapses. */
export const CREDENTIAL_EXPIRING_SOON_DAYS = 90;

/**
 * Days before expiry at which the holder is emailed a warning. Matching the
 * background-check cadence, so a coach with both gets one rhythm of reminders
 * rather than two.
 */
export const CREDENTIAL_EXPIRY_WARNING_DAYS: readonly number[] = [90, 60, 30, 14, 7];

/**
 * Whole days from today until a date-only expiry value, negative once it has
 * passed. Both sides are pinned to UTC midnight so a club west of UTC does not
 * see an expiry a day early, matching how background-check dates are handled.
 */
export function daysUntilCredentialExpiry(
  expiryDate: string | Date,
  now: Date = new Date()
): number {
  const expiry =
    typeof expiryDate === 'string'
      ? Date.parse(`${expiryDate.slice(0, 10)}T00:00:00Z`)
      : Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((expiry - today) / 86400000);
}

/**
 * The status a credential should hold given its expiry date. A credential with
 * no expiry date never lapses (a level 2 coaching award, say) and stays valid.
 */
export function deriveCredentialStatus(
  expiryDate: string | Date | null | undefined,
  now: Date = new Date()
): CredentialStatus {
  if (!expiryDate) return CredentialStatus.VALID;
  const days = daysUntilCredentialExpiry(expiryDate, now);
  if (days < 0) return CredentialStatus.EXPIRED;
  if (days <= CREDENTIAL_EXPIRING_SOON_DAYS) return CredentialStatus.EXPIRING_SOON;
  return CredentialStatus.VALID;
}

/**
 * One credential held by one subject.
 *
 * Exactly one of user_id and member_id is set. Most credentials belong to
 * staff and coaches, who are users; a gymnast can hold one too (a young
 * leaders' award, a judging qualification), so the subject is modelled as a
 * choice rather than forced onto the user table.
 */
export interface Credential {
  credential_id: string;
  club_id: string;
  /** The staff member or volunteer holding it, when the subject is a user. */
  user_id: string | null;
  /** The gymnast holding it, when the subject is a member. */
  member_id: string | null;
  credential_type: CredentialType;
  /** What the credential actually is, e.g. "Emergency First Aid at Work". */
  title: string;
  /** Who awarded it, e.g. "British Gymnastics", "St John Ambulance". */
  issuing_body: string | null;
  /** Certificate or reference number, where the awarding body issues one. */
  reference_number: string | null;
  issue_date: string;
  /** Null for a credential that does not expire. */
  expiry_date: string | null;
  status: CredentialStatus;
  /** Where the certificate itself is filed: a URL or a filing reference. */
  document_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}
