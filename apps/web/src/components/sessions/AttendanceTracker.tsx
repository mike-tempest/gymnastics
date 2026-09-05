'use client';

import { AttendanceStatus, Swimmer } from '@club-manager/shared-types';
import { useState, useEffect, useCallback } from 'react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { getSessionAttendance, markAttendance } from '@/lib/api/attendance';
import { getSquadSwimmers } from '@/lib/api/squads';

interface AttendanceTrackerProps {
  sessionId: string;
  squadId: string;
  onUpdate?: () => void;
}

const statusColors = {
  [AttendanceStatus.PRESENT]: 'bg-green-500/20 text-green-400 border-green-500/40',
  [AttendanceStatus.ABSENT]: 'bg-red-500/20 text-red-400 border-red-500/40',
  [AttendanceStatus.LATE]: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  [AttendanceStatus.EXCUSED]: 'bg-brand/20 text-brand border-brand/40',
};

const statusLabels = {
  [AttendanceStatus.PRESENT]: 'Present',
  [AttendanceStatus.ABSENT]: 'Absent',
  [AttendanceStatus.LATE]: 'Late',
  [AttendanceStatus.EXCUSED]: 'Excused',
};

export default function AttendanceTracker({ sessionId, squadId, onUpdate }: AttendanceTrackerProps) {
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Map<string, AttendanceStatus | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch squad swimmers and existing attendance records
      const [squadSwimmers, existingAttendance] = await Promise.all([
        getSquadSwimmers(squadId),
        getSessionAttendance(sessionId),
      ]);

      setSwimmers(squadSwimmers);

      // Create a map of swimmer_id -> attendance status
      const attendanceMap = new Map<string, AttendanceStatus | null>();
      squadSwimmers.forEach((swimmer) => {
        const attendance = existingAttendance.find((a) => a.swimmer_id === swimmer.swimmer_id);
        attendanceMap.set(swimmer.swimmer_id, attendance?.status || null);
      });

      setAttendanceRecords(attendanceMap);
    } catch {
      setError('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, squadId]);

  useEffect(() => {
    fetchData();
  }, [sessionId, squadId, fetchData]);

  const handleStatusChange = async (swimmerId: string, status: AttendanceStatus) => {
    try {
      setIsSaving(true);
      setError(null);

      // Mark attendance for this swimmer
      await markAttendance(sessionId, [swimmerId], status);

      // Update local state
      setAttendanceRecords((prev) => {
        const newMap = new Map(prev);
        newMap.set(swimmerId, status);
        return newMap;
      });

      onUpdate?.();
    } catch {
      setError('Failed to update attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckInAll = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Mark all swimmers as present
      const swimmerIds = swimmers.map((s) => s.swimmer_id);
      await markAttendance(sessionId, swimmerIds, AttendanceStatus.PRESENT);

      // Update local state
      setAttendanceRecords((prev) => {
        const newMap = new Map(prev);
        swimmers.forEach((swimmer) => {
          newMap.set(swimmer.swimmer_id, AttendanceStatus.PRESENT);
        });
        return newMap;
      });

      onUpdate?.();
    } catch {
      setError('Failed to check in all swimmers');
    } finally {
      setIsSaving(false);
    }
  };

  const attendanceCount = Array.from(attendanceRecords.values()).filter(
    (status) => status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE
  ).length;

  if (isLoading) {
    return <LoadingSpinner size="sm" message="Loading attendance..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-2xl text-white">Attendance Tracker</h3>
          <p className="text-text-secondary mt-1 tabular-nums">
            {attendanceCount} / {swimmers.length} attended
          </p>
        </div>
        <button
          onClick={handleCheckInAll}
          disabled={isSaving}
          className="px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Checking In...' : 'Check In All'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-xl">
          <p className="text-red-400 font-semibold">{error}</p>
        </div>
      )}

      {/* Attendance List */}
      {swimmers.length === 0 ? (
        <div className="text-center py-8 bg-dark-primary/80 rounded-xl border border-white/20">
          <p className="text-text-secondary">No swimmers in this squad</p>
        </div>
      ) : (
        <div className="space-y-3">
          {swimmers.map((swimmer) => {
            const status = attendanceRecords.get(swimmer.swimmer_id);
            return (
              <div
                key={swimmer.swimmer_id}
                className="p-4 bg-dark-primary/80 rounded-xl border border-white/20 hover:border-brand/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-semibold">
                      {swimmer.first_name} {swimmer.last_name}
                    </h4>
                    {swimmer.dob && (
                      <p className="text-text-tertiary text-sm mt-1">
                        Age: {new Date().getFullYear() - new Date(swimmer.dob).getFullYear()}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Status Buttons */}
                    {Object.values(AttendanceStatus).map((statusOption) => (
                      <button
                        key={statusOption}
                        onClick={() => handleStatusChange(swimmer.swimmer_id, statusOption)}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 border ${
                          status === statusOption
                            ? statusColors[statusOption]
                            : 'bg-white/10 text-text-secondary border-white/20 hover:border-brand/40'
                        }`}
                      >
                        {statusLabels[statusOption]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-green-400 text-sm font-semibold mb-1">Present</p>
          <p className="text-white text-2xl font-bold tabular-nums">
            {Array.from(attendanceRecords.values()).filter((s) => s === AttendanceStatus.PRESENT).length}
          </p>
        </div>
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <p className="text-yellow-400 text-sm font-semibold mb-1">Late</p>
          <p className="text-white text-2xl font-bold tabular-nums">
            {Array.from(attendanceRecords.values()).filter((s) => s === AttendanceStatus.LATE).length}
          </p>
        </div>
        <div className="p-4 bg-brand/10 border border-brand/30 rounded-xl">
          <p className="text-brand text-sm font-semibold mb-1">Excused</p>
          <p className="text-white text-2xl font-bold tabular-nums">
            {Array.from(attendanceRecords.values()).filter((s) => s === AttendanceStatus.EXCUSED).length}
          </p>
        </div>
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm font-semibold mb-1">Absent</p>
          <p className="text-white text-2xl font-bold tabular-nums">
            {Array.from(attendanceRecords.values()).filter((s) => s === AttendanceStatus.ABSENT).length}
          </p>
        </div>
      </div>
    </div>
  );
}
