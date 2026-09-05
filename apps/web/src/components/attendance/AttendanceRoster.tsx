'use client';

import { Attendance, AttendanceStatus } from '@club-manager/shared-types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  getSessionAttendance,
  checkInMember,
  updateAttendance,
  markAttendance,
} from '@/lib/api/attendance';
import { fetchSessionReadiness, type MemberReadiness } from '@/lib/api/wellbeing';

import MemberCheckIn from './MemberCheckIn';
import SessionStats from './SessionStats';
import StatusSelector from './StatusSelector';

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
  const [selectedMember, setSelectedMember] = useState<Attendance | null>(null);
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

  const memberIds = useMemo(
    () => attendance.map((r) => r.member_id),
    [attendance],
  );

  const today = new Date().toISOString().split('T')[0];
  const { data: readinessData } = useQuery({
    queryKey: ['session-readiness', sessionId, today],
    queryFn: () => fetchSessionReadiness(memberIds, today),
    enabled: memberIds.length > 0,
    refetchInterval: 60_000,
  });

  const readinessMap = useMemo(() => {
    const map = new Map<string, MemberReadiness>();
    if (readinessData?.members) {
      for (const s of readinessData.members) {
        map.set(s.member_id, s);
      }
    }
    return map;
  }, [readinessData]);

  const checkInMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      checkInMember(sessionId, memberId),
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
    mutationFn: ({ memberIds, status }: { memberIds: string[]; status: AttendanceStatus }) =>
      markAttendance(sessionId, memberIds, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-attendance', sessionId] });
      setShowBulkSuccess(true);
      toast.success('All members marked as present');
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

  const unmarkedMembers = useMemo(
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
      checkInMutation.mutate({ memberId: record.member_id });
    }
  }

  function handleLongPress(record: Attendance) {
    setSelectedMember(record);
  }

  function handleStatusSelect(status: AttendanceStatus, notes: string | null) {
    if (!selectedMember) return;

    if (selectedMember.attendance_id) {
      updateMutation.mutate({
        attendanceId: selectedMember.attendance_id,
        status,
        notes,
      });
    } else {
      checkInMutation.mutate({ memberId: selectedMember.member_id });
    }

    setSelectedMember(null);
  }

  function handleMarkAllPresent() {
    if (unmarkedMembers.length === 0) return;
    const memberIds = unmarkedMembers.map((record) => record.member_id);
    bulkMarkMutation.mutate({ memberIds, status: AttendanceStatus.PRESENT });
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
        title="No members in this session"
        description="Assign members to this session and they will appear here ready to check in."
        hint="Add members to the session's squad, then return to take the register."
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
            {attendance.length} member{attendance.length !== 1 ? 's' : ''}
          </p>
        </div>
        {unmarkedMembers.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={bulkMarkMutation.isPending}
            className="px-4 py-2.5 min-h-[44px] rounded-xl font-semibold text-sm transition-all active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed bg-brand text-dark-primary hover:bg-brand-light"
          >
            {bulkMarkMutation.isPending
              ? 'Marking...'
              : `Mark All Present (${unmarkedMembers.length})`}
          </button>
        )}
      </div>

      {/* Success notification */}
      {showBulkSuccess && (
        <div className="p-3 rounded-xl border animate-in slide-in-from-top-2 duration-200 no-print bg-success/15 border-success/30 text-success">
          <p className="text-sm font-medium text-center flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" />
            Marked {unmarkedMembers.length} member{unmarkedMembers.length !== 1 ? 's' : ''} as present
          </p>
        </div>
      )}

      {/* Member list (screen only) */}
      <div className="space-y-3 no-print">
        {attendance.map((record) => (
          <MemberCheckIn
            key={record.member_id}
            memberId={record.member_id}
            firstName={record.member?.first_name ?? 'Unknown'}
            lastName={record.member?.last_name ?? ''}
            status={record.status ?? null}
            notes={record.notes ?? null}
            photoUrl={record.member?.photo_url ?? null}
            readiness={readinessMap.get(record.member_id)?.readiness ?? null}
            prefersLandTraining={readinessMap.get(record.member_id)?.prefers_land_training}
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
            <th>Member</th>
            {squadName && <th>Squad</th>}
            <th className="print-status-cell">Status</th>
            <th className="print-notes-cell">Notes</th>
          </tr>
        </thead>
        <tbody>
          {attendance.map((record, index) => (
            <tr key={record.member_id}>
              <td className="print-checkbox-cell">
                {record.status === AttendanceStatus.PRESENT || record.status === AttendanceStatus.LATE ? (
                  <span className="print-checkbox-checked">&times;</span>
                ) : (
                  <span className="print-checkbox" />
                )}
              </td>
              <td>{index + 1}</td>
              <td>
                {record.member?.last_name ?? ''}, {record.member?.first_name ?? 'Unknown'}
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
      {selectedMember && (
        <StatusSelector
          memberName={`${selectedMember.member?.first_name ?? ''} ${selectedMember.member?.last_name ?? ''}`.trim()}
          currentStatus={selectedMember.status ?? null}
          currentNotes={selectedMember.notes ?? null}
          onSelect={handleStatusSelect}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
