'use client';

import { X, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import {
  type CompetitionResult,
  type CreateResultInput,
  type RelayLeg,
} from '@/lib/api/competitions';
import { getSwimmers } from '@/lib/api/swimmers';
import { formatSwimTime, parseSwimTimeInput } from '@/lib/competitions-utils';

const STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'];
const DISTANCES = [25, 50, 100, 200, 400, 800, 1500];

interface Swimmer {
  swimmer_id: string;
  first_name: string;
  last_name: string;
}

interface RelayLegDraft {
  swimmer_id: string;
  name: string;
  split: string;
}

interface AddResultModalProps {
  result?: CompetitionResult | null;
  onClose: () => void;
  onSubmit: (data: CreateResultInput) => Promise<void>;
}

function timeToInput(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '';
  return formatSwimTime(seconds).replace(/^00:/, '').replace(/^0/, '');
}

export default function AddResultModal({ result, onClose, onSubmit }: AddResultModalProps) {
  const isEditing = !!result;
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [swimmerId, setSwimmerId] = useState(result?.swimmer_id ?? '');
  const [eventName, setEventName] = useState(result?.event_name ?? '');
  const [distance, setDistance] = useState(result?.distance ?? 100);
  const [stroke, setStroke] = useState(result?.stroke ?? 'Freestyle');
  const [time, setTime] = useState(timeToInput(result?.time));
  const [place, setPlace] = useState(result?.place ? String(result.place) : '');
  const [heat, setHeat] = useState(result?.heat ? String(result.heat) : '');
  const [lane, setLane] = useState(result?.lane ? String(result.lane) : '');
  const [dq, setDq] = useState(result?.dq ?? false);
  const [dqReason, setDqReason] = useState(result?.dq_reason ?? '');
  const [splits, setSplits] = useState(
    result?.splits?.map((s) => formatSwimTime(s).replace(/^00:/, '').replace(/^0/, '')).join(', ') ?? '',
  );
  const [isRelay, setIsRelay] = useState(result?.is_relay ?? false);
  const [relayLegs, setRelayLegs] = useState<RelayLegDraft[]>(
    result?.relay_legs?.map((leg) => ({
      swimmer_id: leg.swimmer_id ?? '',
      name: leg.name ?? '',
      split: timeToInput(leg.split),
    })) ?? [
      { swimmer_id: '', name: '', split: '' },
      { swimmer_id: '', name: '', split: '' },
      { swimmer_id: '', name: '', split: '' },
      { swimmer_id: '', name: '', split: '' },
    ],
  );

  useEffect(() => {
    getSwimmers().then(setSwimmers).catch(() => {});

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  function updateLeg(index: number, field: keyof RelayLegDraft, value: string) {
    setRelayLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg)));
  }

  function addLeg() {
    setRelayLegs((prev) => [...prev, { swimmer_id: '', name: '', split: '' }]);
  }

  function removeLeg(index: number) {
    if (relayLegs.length <= 2) return;
    setRelayLegs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!swimmerId) {
      setFormError('Select a swimmer.');
      return;
    }

    const parsedTime = dq ? 0 : parseSwimTimeInput(time);
    if (!dq && parsedTime === null) {
      setFormError('Enter a valid time, such as 32.50 or 1:05.23.');
      return;
    }

    let parsedSplits: number[] | undefined;
    if (splits.trim()) {
      const parts = splits.split(/[,\s]+/).filter(Boolean);
      const parsed = parts.map(parseSwimTimeInput);
      if (parsed.some((p) => p === null)) {
        setFormError('One or more splits could not be read. Use times like 31.20 or 1:05.23.');
        return;
      }
      parsedSplits = parsed as number[];
    }

    let parsedLegs: RelayLeg[] | undefined;
    if (isRelay) {
      const legs = relayLegs.filter((leg) => leg.swimmer_id || leg.name);
      if (legs.length < 2) {
        setFormError('A relay needs at least two named legs.');
        return;
      }
      parsedLegs = [];
      for (let i = 0; i < legs.length; i++) {
        const split = legs[i].split.trim() ? parseSwimTimeInput(legs[i].split) : null;
        if (legs[i].split.trim() && split === null) {
          setFormError(`Leg ${i + 1} has an unreadable split time.`);
          return;
        }
        const legSwimmer = swimmers.find((s) => s.swimmer_id === legs[i].swimmer_id);
        parsedLegs.push({
          leg: i + 1,
          swimmer_id: legs[i].swimmer_id || null,
          name: legs[i].name || (legSwimmer ? `${legSwimmer.first_name} ${legSwimmer.last_name}` : null),
          split,
        });
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        swimmer_id: swimmerId,
        event_name: eventName || undefined,
        distance,
        stroke,
        time: parsedTime ?? 0,
        place: place ? Number(place) : undefined,
        heat: heat ? Number(heat) : undefined,
        lane: lane ? Number(lane) : undefined,
        dq,
        dq_reason: dq && dqReason ? dqReason : undefined,
        splits: parsedSplits,
        is_relay: isRelay,
        relay_legs: parsedLegs,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand/50';
  const labelCls = 'block text-xs text-white/60 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-primary border border-white/10 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-dark-primary border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">{isEditing ? 'Edit Result' : 'Record Result'}</h2>
          <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Swimmer</label>
              <select
                value={swimmerId}
                onChange={(e) => setSwimmerId(e.target.value)}
                className={inputCls}
                disabled={isEditing}
                required
              >
                <option value="">Select swimmer...</option>
                {swimmers.map((s) => (
                  <option key={s.swimmer_id} value={s.swimmer_id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Event name (optional)</label>
              <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="e.g. Event 4" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Distance</label>
              <select value={distance} onChange={(e) => setDistance(Number(e.target.value))} className={inputCls} required>
                {DISTANCES.map((d) => (
                  <option key={d} value={d}>{d}m</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Stroke</label>
              <select value={stroke} onChange={(e) => setStroke(e.target.value)} className={inputCls} required>
                {STROKES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Time</label>
              <input
                type="text"
                inputMode="decimal"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 32.50 or 1:05.23"
                className={inputCls}
                disabled={dq}
                required={!dq}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Place</label>
                <input type="number" min="1" value={place} onChange={(e) => setPlace(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Heat</label>
                <input type="number" min="1" value={heat} onChange={(e) => setHeat(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Lane</label>
                <input type="number" min="1" value={lane} onChange={(e) => setLane(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Splits (optional, comma separated)</label>
            <input
              type="text"
              value={splits}
              onChange={(e) => setSplits(e.target.value)}
              placeholder="e.g. 31.20, 1:05.23, 1:39.80"
              className={inputCls}
            />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={dq} onChange={(e) => setDq(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5" />
              <span className="text-sm text-white/70">Disqualified</span>
            </label>
            <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
              <input type="checkbox" checked={isRelay} onChange={(e) => setIsRelay(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-white/5" />
              <span className="text-sm text-white/70">Relay</span>
            </label>
          </div>

          {dq && (
            <div>
              <label className={labelCls}>DQ reason (optional)</label>
              <input type="text" value={dqReason} onChange={(e) => setDqReason(e.target.value)} placeholder="e.g. Early take-off, leg 3" className={inputCls} />
            </div>
          )}

          {isRelay && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
              <p className="text-xs text-white/40 font-medium">Relay legs (the result is recorded against the lead swimmer above)</p>
              {relayLegs.map((leg, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <label className={labelCls}>Leg {index + 1} swimmer</label>
                    <select value={leg.swimmer_id} onChange={(e) => updateLeg(index, 'swimmer_id', e.target.value)} className={inputCls}>
                      <option value="">Name only...</option>
                      {swimmers.map((s) => (
                        <option key={s.swimmer_id} value={s.swimmer_id}>
                          {s.first_name} {s.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Name</label>
                      <input type="text" value={leg.name} onChange={(e) => updateLeg(index, 'name', e.target.value)} placeholder="If not listed" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Split</label>
                      <input type="text" inputMode="decimal" value={leg.split} onChange={(e) => updateLeg(index, 'split', e.target.value)} placeholder="31.20" className={inputCls} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLeg(index)}
                    disabled={relayLegs.length <= 2}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 rounded disabled:opacity-30"
                    aria-label={`Remove leg ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLeg} className="flex items-center gap-2 text-sm text-white/70 hover:text-white min-h-[44px]">
                <Plus className="w-4 h-4" /> Add leg
              </button>
            </div>
          )}

          {formError && <p className="text-red-400 text-sm">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 min-h-[44px] bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 min-h-[44px] bg-brand hover:bg-brand-light disabled:opacity-50 text-dark-primary font-bold rounded-xl transition-colors">
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Record Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
