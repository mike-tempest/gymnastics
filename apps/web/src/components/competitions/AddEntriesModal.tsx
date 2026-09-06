'use client';

import { X, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

import { type CreateEntryInput } from '@/lib/api/competitions';
import { getMembers } from '@/lib/api/members';
import { MEMBER_NOUN, MEMBER_NOUN_LOWER } from '@/lib/brand';

const STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'];
const DISTANCES = [25, 50, 100, 200, 400, 800, 1500];

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
}

interface AddEntriesModalProps {
  onClose: () => void;
  onSubmit: (entries: CreateEntryInput[]) => Promise<void>;
}

const emptyEntry = (): CreateEntryInput & { key: number } => ({
  key: Date.now() + Math.random(),
  member_id: '',
  event_name: '',
  distance: 100,
  stroke: 'Freestyle',
  entry_time: undefined,
  seed_time: undefined,
  age_group: '',
});

export default function AddEntriesModal({ onClose, onSubmit }: AddEntriesModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<(CreateEntryInput & { key: number })[]>([emptyEntry()]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getMembers().then(setMembers).catch(() => {});

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

  function updateEntry(index: number, field: string, value: string | number | undefined) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e)),
    );
  }

  function addRow() {
    setEntries((prev) => [...prev, emptyEntry()]);
  }

  function removeRow(index: number) {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = entries.filter((entry) => entry.member_id && entry.distance && entry.stroke);
    if (valid.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit(
        // Build CreateEntryInput explicitly so the client-only `key` is dropped
        // without an unused-variable binding (which lints differently between
        // `next lint` and the production `next build`).
        valid.map((entry) => ({
          member_id: entry.member_id,
          event_name: entry.event_name || undefined,
          distance: entry.distance,
          stroke: entry.stroke,
          entry_time: entry.entry_time || undefined,
          seed_time: entry.seed_time || undefined,
          age_group: entry.age_group || undefined,
        })),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-primary border border-white/10 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-dark-primary border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">Add Entries</h2>
          <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {entries.map((entry, index) => (
            <div key={entry.key} className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40 font-medium">Entry {index + 1}</span>
                {entries.length > 1 && (
                  <button type="button" onClick={() => removeRow(index)} className="p-1 hover:bg-white/10 rounded">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">{MEMBER_NOUN}</label>
                  <select
                    value={entry.member_id}
                    onChange={(e) => updateEntry(index, 'member_id', e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">Select {MEMBER_NOUN_LOWER}...</option>
                    {members.map((s) => (
                      <option key={s.member_id} value={s.member_id}>
                        {s.first_name} {s.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Event name (optional)</label>
                  <input
                    type="text"
                    value={entry.event_name || ''}
                    onChange={(e) => updateEntry(index, 'event_name', e.target.value)}
                    placeholder="e.g. Heat 3"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Distance</label>
                  <select
                    value={entry.distance}
                    onChange={(e) => updateEntry(index, 'distance', Number(e.target.value))}
                    className={inputCls}
                    required
                  >
                    {DISTANCES.map((d) => (
                      <option key={d} value={d}>{d}m</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Stroke</label>
                  <select
                    value={entry.stroke}
                    onChange={(e) => updateEntry(index, 'stroke', e.target.value)}
                    className={inputCls}
                    required
                  >
                    {STROKES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Entry time (seconds)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={entry.entry_time ?? ''}
                    onChange={(e) => updateEntry(index, 'entry_time', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 62.34"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Seed time (seconds)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={entry.seed_time ?? ''}
                    onChange={(e) => updateEntry(index, 'seed_time', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="e.g. 63.10"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Age group (optional)</label>
                  <input
                    type="text"
                    value={entry.age_group || ''}
                    onChange={(e) => updateEntry(index, 'age_group', e.target.value)}
                    placeholder="e.g. 11-12 Girls"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={addRow} className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-medium rounded-xl transition-colors">
            <Plus className="w-4 h-4" /> Add another entry
          </button>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 min-h-[44px] bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 py-3 min-h-[44px] bg-brand hover:bg-brand-light disabled:opacity-50 text-dark-primary font-bold rounded-xl transition-colors">
              {isSubmitting ? 'Adding...' : `Add ${entries.filter((e) => e.member_id).length} ${entries.filter((e) => e.member_id).length === 1 ? 'Entry' : 'Entries'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
