'use client';

import { Clock } from 'lucide-react';

import type { WaitingListOffer } from '@/lib/api/waiting-list';

interface PendingOffersPanelProps {
  offers: WaitingListOffer[];
  canManage: boolean;
  onWithdraw: (offer: WaitingListOffer) => void;
}

/** How long is left to answer, in the words a person would use. */
function timeLeft(expiresAt: string): { label: string; urgent: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { label: 'lapsing now', urgent: true };
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return { label: 'under an hour left', urgent: true };
  if (hours < 24) return { label: `${hours} hours left`, urgent: true };
  const days = Math.round(hours / 24);
  return { label: days === 1 ? '1 day left' : `${days} days left`, urgent: days <= 2 };
}

/**
 * Places the club is currently holding for a family (TEM-22).
 *
 * Every row here is a place nobody can train in until the family answers, so
 * it sits above the list rather than inside it, and the countdown is the point
 * of the panel.
 */
export default function PendingOffersPanel({
  offers,
  canManage,
  onWithdraw,
}: PendingOffersPanelProps) {
  if (offers.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-offers-heading"
      className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-8 shadow-lg mb-8"
    >
      <div className="flex items-start gap-3 mb-6">
        <Clock className="w-6 h-6 text-brand flex-shrink-0 mt-1" aria-hidden="true" />
        <div>
          <h2
            id="pending-offers-heading"
            className="font-serif text-3xl text-dark-primary tracking-tight"
          >
            Places on offer
          </h2>
          <p className="text-grey-600 text-sm">
            {offers.length === 1 ? 'One place is' : `${offers.length} places are`} being held while
            {offers.length === 1 ? ' the family decides' : ' families decide'}. Each passes to the
            next child on its own if nobody answers.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {offers.map((offer) => {
          const remaining = timeLeft(offer.expires_at);
          return (
            <li
              key={offer.offer_id}
              className="rounded-2xl border border-grey-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
            >
              <div className="min-w-0">
                <p className="text-dark-primary font-semibold">
                  {offer.entry
                    ? `${offer.entry.child_first_name} ${offer.entry.child_last_name}`
                    : 'A child on the list'}
                  {offer.squad?.squad_name ? ` for ${offer.squad.squad_name}` : ''}
                </p>
                <p className="text-grey-600 text-sm">
                  {offer.entry?.parent_email ?? 'No contact recorded'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    remaining.urgent
                      ? 'bg-danger/10 text-danger border border-danger/30'
                      : 'bg-canvas text-grey-600 border border-grey-200'
                  }`}
                >
                  {remaining.label}
                </span>
                {canManage && (
                  <button
                    onClick={() => onWithdraw(offer)}
                    className="px-4 py-2 min-h-[44px] rounded-xl font-semibold text-sm border border-grey-200 text-dark-primary hover:bg-grey-50 transition-all"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
