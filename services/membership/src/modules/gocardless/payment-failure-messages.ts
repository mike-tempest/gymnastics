/**
 * Payer-facing copy for normalised payment failure causes.
 *
 * GoCardless webhook events carry event.details.cause, a machine-readable
 * value normalised across schemes: a Bacs ARUDD code and its BECS equivalent
 * both arrive as the same cause (e.g. insufficient_funds). Keying copy on the
 * cause therefore serves UK Bacs and Australian BECS clubs alike, so the
 * vocabulary below stays scheme-neutral ("Direct Debit" is correct for both).
 */
export const PAYMENT_FAILURE_MESSAGES: Record<string, string> = {
  insufficient_funds:
    'There were insufficient funds in the account when the payment was attempted.',
  refer_to_payer: 'The bank declined the payment. Contact your bank, then retry.',
  account_closed:
    'The bank account linked to this Direct Debit appears to be closed. Please set up a new Direct Debit.',
  bank_account_closed:
    'The bank account linked to this Direct Debit appears to be closed. Please set up a new Direct Debit.',
  mandate_cancelled:
    'The Direct Debit authorisation was cancelled. Please set up a new Direct Debit to continue automatic payments.',
  payment_stopped:
    'The Direct Debit authorisation was cancelled. Please set up a new Direct Debit to continue automatic payments.',
  direct_debit_not_enabled: 'This bank account does not support Direct Debit.',
  authorisation_disputed:
    'The account holder disputed the Direct Debit authorisation. Please contact the club.',
};

/**
 * The pre-existing generic copy. Events without details must produce emails
 * byte-identical to before this feature, so this string must never change.
 */
export const GENERIC_FAILURE_REASON = 'Payment was unsuccessful';

/** Sentence-cases a provider description: capitalises the first letter only. */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Resolves the payer-facing failure reason for a webhook event's details.
 *
 * Fallback chain: bespoke copy for the normalised cause, then GoCardless's
 * own human-readable description (sentence-cased), then the pre-existing
 * generic copy, so an event without details renders exactly as before.
 */
export function resolveFailureReason(details?: { cause?: string; description?: string }): {
  reason: string;
  isSpecific: boolean;
} {
  const mapped = details?.cause ? PAYMENT_FAILURE_MESSAGES[details.cause] : undefined;
  if (mapped) {
    return { reason: mapped, isSpecific: true };
  }
  if (details?.description) {
    return { reason: sentenceCase(details.description), isSpecific: true };
  }
  return { reason: GENERIC_FAILURE_REASON, isSpecific: false };
}
