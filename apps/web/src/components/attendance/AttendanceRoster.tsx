'use client';

import { Attendance, AttendanceStatus } from '@swim-nexus/shared-types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  getSessionAttendance,
  checkInSwimmer,
  updateAttendance,
  markAttendance,
} from '@/lib/api/attendance';
import { fetchSessionReadiness, type SwimmerReadiness } from '@/lib/api/wellbeing';

import SessionStats from './SessionStats';
import StatusSelector from './StatusSelector';
import SwimmerCheckIn from './SwimmerCheckIn';

interface AttendanceRosterProps {
  sessionId: string;
  sessionName: string;
  squadName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
};

export default function AttendanceRoster({ sessionId, sessionName, squadName }: AttendanceRosterProps) {
  const queryClient = useQueryClient();
  const [selectedSwimmer, setSelectedSwimmer] = useState<Attendance | null>(null);
  const [showBulkSuccess, setShowBulkSuccess] = useState(false);

  const {
    data: attendance = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Attendance[]>({
    queryKey: ['session-attendance', sessionId],
    queryFn: () => getSessionAttendance(sessionId),
    refetchInterval: 30_000,
  });

  const swimmerIds = useMemo(
    () => attendance.map((r) => r.swimmer_id),
    [attendance],
  );

  const today = new Date().toISOString().split('T')[0];
  const { data: readinessData } = useQuery({
    queryKey: ['session-readiness', sessionId, today],
    queryFn: () => fetchSessionReadiness(swimmerIds, today),
    enabled: swimmerIds.length > 0,
    refetchInterval: 60_000,
  });

  const readinessMap = useMemo(() => {
    const map = new Map<string, SwimmerReadiness>();
    if (readinessData?.swimmers) {
      for (const s of readinessData.swimmers) {
        map.set(s.swimmer_id, s);
      }
    }
    return map;
  }, [readinessData]);

  const checkInMutation = useMutation({
    mutationFn: ({ swimmerId }: { swimmerId: string }) =>
      checkInSwimmer(sessionId, swimmerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-attendance', sessionId] });
      toast.success('Attendance recorded');
    },
    onError: () => {
      toast.error('Failed to record attendance');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      attendanceId,
      status,
      notes,
    }: {
      attendanceId: string;
      status: AttendanceStatus;
      notes: string | null;
    }) => updateAttendance(attendanceId, { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-attendance', sessionId] });
      toast.success('Attendance updated');
    },
    onError: () => {
      toast.error('Failed to update attendance');
    },
  });

  const bulkMarkMutation = useMutation({
    mutationFn: ({ swimmerIds, status }: { swimmerIds: string[]; status: AttendanceStatus }) =>
      markAttendance(sessionId, swimmerIds, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-attendance', sessionId] });
      setShowBulkSuccess(true);
      toast.success('All swimmers marked as present');
      setTimeout(() => setShowBulkSuccess(false), 3000);
    },
    onError: () => {
      toast.error('Failed to mark attendance');
    },
  });

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus | 'unmarked', number> = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.EXCUSED]: 0,
      unmarked: 0,
    };
    for (const record of attendance) {
      if (record.status && c[record.status] !== undefined) {
        c[record.status]++;
      } else {
        c.unmarked++;
      }
    }
    return c;
  }, [attendance]);

  const unmarkedSwimmers = useMemo(
    () => attendance.filter((record) => !record.status),
    [attendance]
  );

  function handleQuickPresent(record: Attendance) {
    if (record.attendance_id) {
      updateMutation.mutate({
        attendanceId: record.attendance_id,
        status: AttendanceStatus.PRESENT,
        notes: null,
      });
    } else {
      checkInMutation.mutate({ swimmerId: record.swimmer_id });
    }
  }

  function handleLongPress(record: Attendance) {
    setSelectedSwimmer(record);
  }

  function handleStatusSelect(status: AttendanceStatus, notes: string | null) {
    if (!selectedSwimmer) return;

    if (selectedSwimmer.attendance_id) {
      updateMutation.mutate({
        attendanceId: selectedSwimmer.attendance_id,
        status,
        notes,
      });
    } else {
      checkInMutation.mutate({ swimmerId: selectedSwimmer.swimmer_id });
    }

    setSelectedSwimmer(null);
  }

  function handleMarkAllPresent() {
    if (unmarkedSwimmers.length === 0) return;
    const swimmerIds = unmarkedSwimmers.map((record) => record.swimmer_id);
    bulkMarkMutation.mutate({ swimmerIds, status: AttendanceStatus.PRESENT });
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading roster..." />;
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Failed to load attendance'}
        onRetry={() => refetch()}
      />
    );
  }

  if (attendance.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No swimmers in this session"
        description="Assign swimmers to this session and they will appear here ready to check in."
        hint="Add swimmers to the session's squad, then return to take the register."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Readiness summary */}
      {readinessData && readinessData.total > readinessData.no_data && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 no-print">
          <span className="text-sm font-medium text-white/80">Wellbeing</span>
          <div className="flex items-center gap-3 text-sm">
            {readinessData.green > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <span className="text-white/60">{readinessData.green}</span>
              </span>
            )}
            {readinessData.amber > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span className="text-white/60">{readinessData.amber}</span>
              </span>
            )}
            {readinessData.red > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-white/60">{readinessData.red}</span>
              </span>
            )}
            {readinessData.no_data > 0 && (
              <span className="text-white/40 text-xs">{readinessData.no_data} no data</span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="no-print">
        <SessionStats counts={counts} total={attendance.length} />
      </div>

      {/* Session info bar with bulk action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 no-print">
        <div>
          <p className="text-sm text-white/60 font-medium">{sessionName}</p>
          <p className="text-xs text-white/70 mt-0.5">
            {attendance.length} swimmer{attendance.length !== 1 ? 's' : ''}
          </p>
        </div>
        {unmarkedSwimmers.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={bulkMarkMutation.isPending}
            className="px-4 py-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed bg-brand text-dark-primary hover:bg-brand-light"
          >
            {bulkMarkMutation.isPending
              ? 'Marking...'
              : `Mark All Present (${unmarkedSwimmers.length})`}
          </button>
        )}
      </div>

      {/* Success notification */}
      {showBulkSuccess && (
        <div className="p-3 rounded-xl border animate-in slide-in-from-top-2 duration-200 no-print bg-success/15 border-success/30 text-success">
          <p className="text-sm font-medium text-center flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" />
            Marked {unmarkedSwimmers.length} swimmer{unmarkedSwimmers.length !== 1 ? 's' : ''} as present
          </p>
        </div>
      )}

      {/* Swimmer list (screen only) */}
      <div className="space-y-3 no-print">
        {attendance.map((record) => (
          <SwimmerCheckIn
            key={record.swimmer_id}
            swimmerId={record.swimmer_id}
            firstName={record.swimmer?.first_name ?? 'Unknown'}
            lastName={record.swimmer?.last_name ?? ''}
            status={record.status ?? null}
            notes={record.notes ?? null}
            photoUrl={record.swimmer?.photo_url ?? null}
            readiness={readinessMap.get(record.swimmer_id)?.readiness ?? null}
            prefersLandTraining={readinessMap.get(record.swimmer_id)?.prefers_land_training}
            onQuickPresent={() => handleQuickPresent(record)}
            onLongPress={() => handleLongPress(record)}
          />
        ))}
      </div>

      {/* Print-only roster table (hidden on screen, revealed by print stylesheet) */}
      <table className="print-only print-roster-table hidden">
        <thead>
          <tr>
            <th className="print-checkbox-cell" aria-label="Tick">&nbsp;</th>
            <th className="w-8">#</th>
            <th>Swimmer</th>
            {squadName && <th>Squad</th>}
            <th className="print-status-cell">Status</th>
            <th className="print-notes-cell">Notes</th>
          </tr>
        </thead>
        <tbody>
          {attendance.map((record, index) => (
            <tr key={record.swimmer_id}>
              <td className="print-checkbox-cell">
                {record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE ? (
                  <span className="print-checkbox-checked">&times;</span>
                ) : (
                  <span className="print-checkbox" />
                )}
              </td>
              <td>{index + 1}</td>
              <td>
                {record.swimmer?.last_name ?? ''}, {record.swimmer?.first_name ?? 'Unknown'}
              </td>
              {squadName && <td>{squadName}</td>}
              <td className="print-status-cell">
                {record.status ? (STATUS_LABELS[record.status] ?? record.status) : ''}
              </td>
              <td className="print-notes-cell">{record.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mutation error feedback */}
      {(checkInMutation.isError || updateMutation.isError || bulkMarkMutation.isError) && (
        <div className="p-4 rounded-xl border border-danger/20 text-center no-print bg-danger/10">
          <p className="text-danger text-sm">
            Failed to update attendance. Please try again.
          </p>
        </div>
      )}

      {/* Status selector modal */}
      {selectedSwimmer && (
        <StatusSelector
          swimmerName={`${selectedSwimmer.swimmer?.first_name ?? ''} ${selectedSwimmer.swimmer?.last_name ?? ''}`.trim()}
          currentStatus={selectedSwimmer.status ?? null}
          currentNotes={selectedSwimmer.notes ?? null}
          onSelect={handleStatusSelect}
          onClose={() => setSelectedSwimmer(null)}
        />
      )}
    </div>
  );
}
