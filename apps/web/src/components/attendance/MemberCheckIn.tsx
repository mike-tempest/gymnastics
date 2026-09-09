'use client';

import { AttendanceStatus } from '@club-manager/shared-types';
import Image from 'next/image';
import { useRef } from 'react';

import ReadinessIndicator from './ReadinessIndicator';

interface MemberCheckInProps {
  memberId: string;
  firstName: string;
  lastName: string;
  status: AttendanceStatus | null;
  notes: string | null;
  photoUrl?: string | null;
  readiness?: 'green' | 'amber' | 'red' | null;
  prefersLandTraining?: boolean;
  onQuickPresent: () => void;
  onLongPress: () => void;
}

const STATUS_DISPLAY: Record<
  AttendanceStatus,
  {
    label: string;
    rowClass: string;
    avatarClass: string;
    notesClass: string;
    badgeClass: string;
  }
> = {
  [AttendanceStatus.PRESENT]: {
    label: 'Present',
    rowClass: 'bg-success/10 border-success/30',
    avatarClass: 'bg-success/10 text-success',
    notesClass: 'text-success/80',
    badgeClass: 'bg-success/10 text-success border border-success/30',
  },
  [AttendanceStatus.LATE]: {
    label: 'Late',
    rowClass: 'bg-warning/10 border-warning/30',
    avatarClass: 'bg-warning/10 text-warning',
    notesClass: 'text-warning/80',
    badgeClass: 'bg-warning/10 text-warning border border-warning/30',
  },
  [AttendanceStatus.ABSENT]: {
    label: 'Absent',
    rowClass: 'bg-danger/10 border-danger/30',
    avatarClass: 'bg-danger/10 text-danger',
    notesClass: 'text-danger/80',
    badgeClass: 'bg-danger/10 text-danger border border-danger/30',
  },
  [AttendanceStatus.EXCUSED]: {
    label: 'Excused',
    rowClass: 'bg-info/10 border-info/30',
    avatarClass: 'bg-info/10 text-info',
    notesClass: 'text-info/80',
    badgeClass: 'bg-info/10 text-info border border-info/30',
  },
};

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export default function MemberCheckIn({
  memberId,
  firstName,
  lastName,
  status,
  notes,
  photoUrl,
  readiness,
  prefersLandTraining,
  onQuickPresent,
  onLongPress,
}: MemberCheckInProps) {
  const display = status ? STATUS_DISPLAY[status] : null;
  const fullName = `${firstName} ${lastName}`;
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
    }, 500); // 500ms long-press threshold
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressTriggered.current) {
      // Quick tap - mark present if not already marked
      if (!status) {
        onQuickPresent();
      } else {
        // If already has status, open modal
        onLongPress();
      }
    }
  };

  const handleMouseDown = () => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressTriggered.current) {
      if (!status) {
        onQuickPresent();
      } else {
        onLongPress();
      }
    }
  };

  return (
    <button
      type="button"
      data-testid="roster-member"
      data-member-id={memberId}
      data-status={status ?? 'unmarked'}
      aria-label={`${fullName}: ${display ? display.label : 'not yet marked'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`w-full flex items-center gap-4 p-4 min-h-[72px] rounded-xl border transition-all active:scale-[0.98] ${
        display ? display.rowClass : 'bg-white/10 border-white/15'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden ${
          display ? display.avatarClass : 'bg-white/[0.06] text-text-tertiary'
        }`}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={fullName}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        ) : (
          getInitials(firstName, lastName)
        )}
      </div>

      {/* Name & notes */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`font-semibold text-base truncate ${status ? 'text-white' : 'text-white/60'}`}
          >
            {fullName}
          </p>
          <ReadinessIndicator
            readiness={readiness ?? null}
            prefersLandTraining={prefersLandTraining}
          />
        </div>
        {notes && (
          <p
            className={`text-xs truncate mt-0.5 ${display ? display.notesClass : 'text-text-tertiary'}`}
          >
            {notes}
          </p>
        )}
      </div>

      {/* Status badge */}
      <div
        className={`shrink-0 px-3 py-2 rounded-lg text-base font-semibold min-w-[80px] text-center ${
          display ? display.badgeClass : 'bg-white/5 text-text-tertiary border border-white/[0.08]'
        }`}
      >
        {display ? display.label : 'Tap'}
      </div>
    </button>
  );
}
