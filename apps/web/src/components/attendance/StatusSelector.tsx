'use client';

import { AttendanceStatus } from '@club-manager/shared-types';
import { Check, Clock, Info, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StatusSelectorProps {
  memberName: string;
  currentStatus: AttendanceStatus | null;
  currentNotes: string | null;
  onSelect: (status: AttendanceStatus, notes: string | null) => void;
  onClose: () => void;
}

const STATUS_OPTIONS: {
  status: AttendanceStatus;
  label: string;
  icon: LucideIcon;
  selectedClass: string;
}[] = [
  {
    status: AttendanceStatus.PRESENT,
    label: 'Present',
    icon: Check,
    selectedClass: 'bg-success/15 border-success text-success',
  },
  {
    status: AttendanceStatus.LATE,
    label: 'Late',
    icon: Clock,
    selectedClass: 'bg-warning/15 border-warning text-warning',
  },
  {
    status: AttendanceStatus.ABSENT,
    label: 'Absent',
    icon: X,
    selectedClass: 'bg-danger/15 border-danger text-danger',
  },
  {
    status: AttendanceStatus.EXCUSED,
    label: 'Excused',
    icon: Info,
    selectedClass: 'bg-info/15 border-info text-info',
  },
];

const UNSELECTED_OPTION_CLASS = 'bg-white/[0.03] border-white/[0.06] text-text-tertiary';

function parseMinutesFromNotes(notes: string | null): number {
  if (!notes) return 0;
  const match = notes.match(/^(\d+)\s*minutes?\s*late$/i);
  return match ? parseInt(match[1], 10) : 0;
}

const ABSENCE_REASONS = [
  'Illness/Unwell',
  'Family commitment',
  'School commitment',
  'Competition elsewhere',
  'Holiday',
  'Injury',
  'Not notified',
] as const;

function parseReasonFromNotes(
  notes: string | null,
  status: AttendanceStatus | null
): { selectedReason: string; customReason: string } {
  if (!notes || status === AttendanceStatus.LATE) {
    return { selectedReason: '', customReason: '' };
  }
  if (ABSENCE_REASONS.includes(notes as (typeof ABSENCE_REASONS)[number])) {
    return { selectedReason: notes, customReason: '' };
  }
  return { selectedReason: 'other', customReason: notes };
}

export default function StatusSelector({
  memberName,
  currentStatus,
  currentNotes,
  onSelect,
  onClose,
}: StatusSelectorProps) {
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(currentStatus);
  const [minutesLate, setMinutesLate] = useState<number>(
    currentStatus === AttendanceStatus.LATE ? parseMinutesFromNotes(currentNotes) : 15
  );
  const parsedReasons = parseReasonFromNotes(currentNotes, currentStatus);
  const [selectedReason, setSelectedReason] = useState<string>(parsedReasons.selectedReason);
  const [customReason, setCustomReason] = useState<string>(parsedReasons.customReason);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleConfirm() {
    if (!selectedStatus) return;

    let notes: string | null = null;
    if (selectedStatus === AttendanceStatus.LATE && minutesLate > 0) {
      notes = `${minutesLate} minutes late`;
    } else if (
      (selectedStatus === AttendanceStatus.ABSENT || selectedStatus === AttendanceStatus.EXCUSED) &&
      selectedReason
    ) {
      notes = selectedReason === 'other' ? customReason.trim() || null : selectedReason;
    }

    onSelect(selectedStatus, notes);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const showMinutesInput = selectedStatus === AttendanceStatus.LATE;
  const showReasonInput =
    selectedStatus === AttendanceStatus.ABSENT || selectedStatus === AttendanceStatus.EXCUSED;

  // Authorised (excused) absences read as informational; unexcused as danger.
  const reasonActiveClass =
    selectedStatus === AttendanceStatus.EXCUSED
      ? 'bg-info/15 border-info text-info'
      : 'bg-danger/15 border-danger text-danger';

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-selector-title"
        className="w-full max-w-[calc(100vw-2rem)] sm:max-w-md mx-4 mb-4 md:mb-0 rounded-card border border-white/20 bg-dark-secondary overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/5">
          <h3 id="status-selector-title" className="text-lg font-semibold text-white">
            {memberName}
          </h3>
          <p className="text-sm text-white/60 mt-0.5">Select attendance status</p>
        </div>

        {/* Status buttons */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {STATUS_OPTIONS.map(({ status, label, icon: Icon, selectedClass }) => {
            const isSelected = selectedStatus === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setSelectedStatus(status)}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all min-h-[56px] ${
                  isSelected ? selectedClass : UNSELECTED_OPTION_CLASS
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-semibold text-base">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Conditional inputs */}
        {showMinutesInput && (
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-white/60 mb-2">Minutes late</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Decrease minutes"
                onClick={() => setMinutesLate(Math.max(5, minutesLate - 5))}
                className="w-14 h-14 rounded-xl border border-white/20 text-white text-xl font-bold flex items-center justify-center active:bg-white/10 transition-colors"
              >
                −
              </button>
              <div className="flex-1 h-14 rounded-xl border border-white/20 flex items-center justify-center bg-warning/10">
                <span className="text-2xl font-bold text-warning tabular-nums">{minutesLate}</span>
                <span className="text-sm text-white/60 ml-2">min</span>
              </div>
              <button
                type="button"
                aria-label="Increase minutes"
                onClick={() => setMinutesLate(Math.min(120, minutesLate + 5))}
                className="w-14 h-14 rounded-xl border border-white/20 text-white text-xl font-bold flex items-center justify-center active:bg-white/10 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        )}

        {showReasonInput && (
          <div className="px-6 pb-4 space-y-3">
            <label className="block text-sm font-medium text-white/60">Reason (optional)</label>
            <div className="grid grid-cols-2 gap-2">
              {ABSENCE_REASONS.map((reason) => {
                const isActive = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(isActive ? '' : reason)}
                    className={`h-12 px-3 rounded-xl border text-sm font-medium text-left transition-all active:scale-[0.97] ${
                      isActive ? reasonActiveClass : UNSELECTED_OPTION_CLASS
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedReason(selectedReason === 'other' ? '' : 'other')}
                className={`h-12 px-3 rounded-xl border text-sm font-medium text-left transition-all active:scale-[0.97] ${
                  selectedReason === 'other' ? reasonActiveClass : UNSELECTED_OPTION_CLASS
                }`}
              >
                Other…
              </button>
            </div>
            {selectedReason === 'other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter reason"
                aria-label="Custom absence reason"
                autoFocus
                className="w-full h-14 px-4 rounded-xl border border-white/20 bg-white/[0.03] text-white text-base placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/50 transition-colors"
              />
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-14 rounded-xl border border-white/20 text-white/60 font-semibold text-base active:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedStatus}
            className="flex-1 h-14 rounded-xl bg-brand text-dark-primary font-semibold text-base hover:bg-brand-light transition-all disabled:opacity-30 disabled:hover:bg-brand"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
