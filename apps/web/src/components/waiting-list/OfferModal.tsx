'use client';

import { Squad } from '@club-manager/shared-types';
import { useEffect, useState } from 'react';

import type { WaitingListRow } from '@/lib/api/waiting-list';

interface OfferModalProps {
  /** The entry being offered a place, or null when the modal is closed. */
  row: WaitingListRow | null;
  squads: Squad[];
  defaultWindowDays: number;
  onSubmit: (squadId: string, expiresInDays?: number) => Promise<void>;
  onClose: () => void;
}

/**
 * The manual offer (TEM-22). Auto-offer handles the ordinary case, so this is
 * for the times a club wants to put a particular child in a particular class
 * itself: a returning family, a class that has just been created, a decision
 * made on the phone.
 *
 * The API still applies the eligibility rules, so a class the child is too
 * young for is refused here rather than quietly allowed.
 */
export default function OfferModal({
  row,
  squads,
  defaultWindowDays,
  onSubmit,
  onClose,
}: OfferModalProps) {
  const [squadId, setSquadId] = useState('');
  const [windowDays, setWindowDays] = useState(defaultWindowDays);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!row) return;
    setSquadId(row.preferred_squad_id ?? '');
    setWindowDays(defaultWindowDays);
  }, [row, defaultWindowDays]);

  if (!row) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!squadId) return;
    try {
      setIsSubmitting(true);
      await onSubmit(squadId, windowDays === defaultWindowDays ? undefined : windowDays);
    } catch {
      // The page has already told the user; keep the modal open so the choice
      // can be corrected rather than retyped.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-dark-primary rounded-3xl border border-white/20 shadow-lg p-6 sm:p-8">
        <h2 className="font-serif text-3xl text-white mb-2">Offer a place</h2>
        <p className="text-text-secondary text-sm mb-6">
          To {row.child_first_name} {row.child_last_name}, whose parent is {row.parent_name}.
        </p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="offer-squad" className="block text-sm font-semibold text-white mb-2">
              Class or squad
            </label>
            <select
              id="offer-squad"
              required
              value={squadId}
              onChange={(event) => setSquadId(event.target.value)}
              className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
            >
              <option value="">Please choose</option>
              {squads.map((squad) => (
                <option key={squad.squad_id} value={squad.squad_id}>
                  {squad.squad_name}
                </option>
              ))}
            </select>
            {row.preferred_squad?.squad_name && (
              <p className="mt-2 text-sm text-text-tertiary">
                The family asked for {row.preferred_squad.squad_name}, so only that class can be
                offered.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="offer-window" className="block text-sm font-semibold text-white mb-2">
              Days to reply
            </label>
            <input
              id="offer-window"
              type="number"
              min={1}
              max={60}
              value={windowDays}
              onChange={(event) => setWindowDays(Number(event.target.value))}
              className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
            />
            <p className="mt-2 text-sm text-text-tertiary">
              The place is held until then. After that it passes to the next family on its own.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !squadId}
              className="flex-1 min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Send the offer'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] px-6 py-3 bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
