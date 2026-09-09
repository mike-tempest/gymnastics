'use client';

import { useEffect, useState } from 'react';

import type { WaitingListSettings } from '@/lib/api/waiting-list';

interface WaitingListSettingsCardProps {
  settings: WaitingListSettings;
  onSave: (next: Partial<WaitingListSettings>) => Promise<void>;
}

/**
 * How this club runs its waiting list (TEM-22).
 *
 * Auto-offer is on by default and switching it off is deliberately framed as
 * the exception: manual invite is the fallback, never the default (docs/05
 * rule 3).
 */
export default function WaitingListSettingsCard({
  settings,
  onSave,
}: WaitingListSettingsCardProps) {
  const [autoOffer, setAutoOffer] = useState(settings.auto_offer_enabled);
  const [windowDays, setWindowDays] = useState(settings.offer_window_days);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAutoOffer(settings.auto_offer_enabled);
    setWindowDays(settings.offer_window_days);
  }, [settings]);

  // An emptied number input reads back as NaN, which is neither a change worth
  // saving nor a value the server can store, so it is treated as untouched.
  const windowDaysIsUsable = Number.isInteger(windowDays);

  const dirty =
    autoOffer !== settings.auto_offer_enabled ||
    (windowDaysIsUsable && windowDays !== settings.offer_window_days);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onSave({
        auto_offer_enabled: autoOffer,
        ...(windowDaysIsUsable ? { offer_window_days: windowDays } : {}),
      });
    } catch {
      // The page reports the failure; leave the edited values on screen.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="waiting-list-settings-heading"
      className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-8 shadow-lg mb-8"
    >
      <h2
        id="waiting-list-settings-heading"
        className="font-serif text-3xl text-dark-primary tracking-tight mb-6"
      >
        How your waiting list works
      </h2>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="max-w-xl">
            <label
              htmlFor="auto-offer"
              className="block text-dark-primary font-semibold mb-1 cursor-pointer"
            >
              Offer places automatically
            </label>
            <p className="text-grey-600 text-sm">
              When a place opens, the highest-priority child who fits the class is offered it
              straight away. Turn this off and every place has to be offered by hand, which is what
              other systems make you do.
            </p>
          </div>
          <label className="flex items-center gap-3 flex-shrink-0 min-h-[48px]">
            <input
              id="auto-offer"
              type="checkbox"
              checked={autoOffer}
              onChange={(event) => setAutoOffer(event.target.checked)}
              className="w-6 h-6 rounded border-grey-200"
            />
            <span className="text-dark-primary font-semibold text-sm">
              {autoOffer ? 'On' : 'Off'}
            </span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="max-w-xl">
            <label
              htmlFor="offer-window-days"
              className="block text-dark-primary font-semibold mb-1"
            >
              Days a family has to reply
            </label>
            <p className="text-grey-600 text-sm">
              After this the offer lapses and the place goes to the next child. Their position on
              the list is not lost.
            </p>
          </div>
          <input
            id="offer-window-days"
            type="number"
            min={1}
            max={60}
            value={windowDays}
            onChange={(event) => setWindowDays(Number(event.target.value))}
            className="w-full sm:w-28 min-h-[48px] px-4 py-3 rounded-xl border border-grey-200 bg-white text-dark-primary focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!dirty || isSaving}
          className="min-h-[48px] px-8 py-3 bg-dark-primary text-white rounded-button font-bold hover:bg-dark-primary/90 transition-all disabled:opacity-40"
        >
          {isSaving ? 'Saving...' : 'Save settings'}
        </button>
      </div>
    </section>
  );
}
