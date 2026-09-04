'use client';

import { ClipboardList } from 'lucide-react';
import { useState, useEffect } from 'react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { api } from '@/lib/api/api-client';

interface AttendanceRecord {
  attendance_id: string;
  session_id: string;
  swimmer_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string | null;
  created_at: string;
  session?: {
    session_name: string;
    session_date: string;
  };
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  present: { label: 'Present', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  absent: { label: 'Absent', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  late: { label: 'Late', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  excused: { label: 'Excused', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

interface AttendanceHistoryProps {
  swimmerId: string;
}

export default function AttendanceHistory({ swimmerId }: AttendanceHistoryProps) {
  const { formatDate } = useFormatters();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AttendanceRecord[]>(`/attendance/swimmer/${swimmerId}`, { cache: 'no-store' })
      .then((data) => setRecords(data.slice(0, 20)))
      .catch(() => setError('Failed to load attendance'))
      .finally(() => setIsLoading(false));
  }, [swimmerId]);

  if (isLoading) return <LoadingSpinner message="Loading attendance..." size="sm" />;
  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (records.length === 0) {
    return (
      <div className="text-center py-6">
        <ClipboardList className="w-8 h-8 text-white/20 mx-auto mb-2" />
        <p className="text-white/40 text-sm">No attendance records yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-brand" />
        <h3 className="font-serif text-xl text-white">Attendance History</h3>
        <span className="text-sm text-white/40">({records.length} recent)</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-white/50 border-b border-white/10">
              <th className="pb-3 font-medium">Date</th>
              <th className="pb-3 font-medium">Session</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {records.map((r) => {
              const style = STATUS_STYLES[r.status] || STATUS_STYLES.present;
              return (
                <tr key={r.attendance_id} className="text-sm">
                  <td className="py-3 text-white/70">{formatDate(r.session?.session_date || r.created_at)}</td>
                  <td className="py-3 text-white">{r.session?.session_name || '-'}</td>
                  <td className="py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${style.cls}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="py-3 text-white/50">{r.notes || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {records.map((r) => {
          const style = STATUS_STYLES[r.status] || STATUS_STYLES.present;
          return (
            <div key={r.attendance_id} className="flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10">
              <div>
                <p className="text-white text-sm font-medium">{r.session?.session_name || 'Session'}</p>
                <p className="text-white/50 text-xs">{formatDate(r.session?.session_date || r.created_at)}</p>
              </div>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${style.cls}`}>
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
