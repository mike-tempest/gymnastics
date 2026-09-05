'use client';

import { AttendanceStatus } from '@club-manager/shared-types';

interface SessionStatsProps {
  counts: Record<AttendanceStatus | 'unmarked', number>;
  total: number;
}

const STAT_CONFIG: {
  key: AttendanceStatus | 'unmarked';
  label: string;
  tileClass: string;
  valueClass: string;
  labelClass: string;
}[] = [
  {
    key: AttendanceStatus.PRESENT,
    label: 'Present',
    tileClass: 'bg-success/15',
    valueClass: 'text-success',
    labelClass: 'text-success/80',
  },
  {
    key: AttendanceStatus.LATE,
    label: 'Late',
    tileClass: 'bg-warning/15',
    valueClass: 'text-warning',
    labelClass: 'text-warning/80',
  },
  {
    key: AttendanceStatus.ABSENT,
    label: 'Absent',
    tileClass: 'bg-danger/15',
    valueClass: 'text-danger',
    labelClass: 'text-danger/80',
  },
  {
    key: AttendanceStatus.EXCUSED,
    label: 'Excused',
    tileClass: 'bg-info/15',
    valueClass: 'text-info',
    labelClass: 'text-info/80',
  },
  {
    key: 'unmarked',
    label: 'Unmarked',
    tileClass: 'bg-white/5',
    valueClass: 'text-text-tertiary',
    labelClass: 'text-text-tertiary/80',
  },
];

export default function SessionStats({ counts, total: _total }: SessionStatsProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3 rounded-card border border-white/5">
      {STAT_CONFIG.map(({ key, label, tileClass, valueClass, labelClass }) => (
        <div
          key={key}
          className={`flex flex-col items-center justify-center py-3 px-2 rounded-xl ${tileClass}`}
        >
          <span className={`text-xl sm:text-2xl font-bold tabular-nums ${valueClass}`}>
            {counts[key] ?? 0}
          </span>
          <span className={`text-[10px] sm:text-xs font-medium mt-0.5 ${labelClass}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
