'use client';

import { Swimmer, Session, Attendance, AttendanceStats } from '@swim-nexus/shared-types';
import { Calendar, ClipboardList, BookOpen } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useEffect , use } from 'react';

import Breadcrumb from '@/components/ui/Breadcrumb';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import {
  fetchParentSwimmer,
  fetchSwimmerAttendanceHistory,
  fetchSwimmerAttendanceStats,
  fetchSwimmerPersonalBests,
  fetchSwimmerResults,
  fetchSwimmerSchedule,
} from '@/lib/api/parent';
import { isCompetitionsEnabled } from '@/lib/features';

// Loaded lazily so the recharts-heavy times UI stays out of the route chunk
// while the competitions module is flagged off (TEM-15).
const PersonalBests = dynamic(() => import('@/components/swimmers/PersonalBests'), {
  ssr: false,
});

function formatTime(time: string): string {
  return time.slice(0, 5);
}

function formatGender(gender: string): string {
  if (gender === 'M') return 'Male';
  if (gender === 'F') return 'Female';
  return 'Other';
}

function calculateAge(dob: string): number {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function attendanceRateColour(rate: number): string {
  if (rate >= 80) return 'text-success';
  if (rate >= 60) return 'text-warning';
  return 'text-danger';
}

function getStatusBadgeClasses(status: Attendance['status']): string {
  const baseClasses = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border';
  switch (status) {
    case 'present':
      return `${baseClasses} bg-success/10 text-success border-success/20`;
    case 'absent':
      return `${baseClasses} bg-danger/10 text-danger border-danger/20`;
    case 'excused':
      return `${baseClasses} bg-brand/10 text-brand border-brand/20`;
    case 'late':
      return `${baseClasses} bg-warning/10 text-warning border-warning/20`;
    default:
      return `${baseClasses} bg-white/5 text-text-tertiary border-white/10`;
  }
}

function getStatusLabel(status: Attendance['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChildDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { formatDate } = useFormatters();
  const [swimmer, setSwimmer] = useState<Swimmer | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChildData() {
      try {
        setIsLoading(true);
        setError(null);

        const [swimmerData, history, stats, sessions] = await Promise.all([
          fetchParentSwimmer(id),
          fetchSwimmerAttendanceHistory(id),
          fetchSwimmerAttendanceStats(id),
          fetchSwimmerSchedule(id),
        ]);

        setSwimmer(swimmerData);
        setAttendanceHistory(history);
        setAttendanceStats(stats);
        setUpcomingSessions(sessions);
      } catch (err) {
        setError('Failed to load swimmer details. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadChildData();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-6 sm:p-10 flex items-center justify-center">
        <LoadingSpinner message="Loading swimmer details..." />
      </div>
    );
  }

  if (error || !swimmer) {
    return (
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error || 'Swimmer not found'} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  const age = calculateAge(swimmer.dob);

  return (
    <div className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/parent' },
            { label: 'My children', href: '/parent/children' },
            { label: `${swimmer.first_name} ${swimmer.last_name}` },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">
            {swimmer.first_name} {swimmer.last_name}
          </h1>
          <p className="text-text-secondary text-lg">Swimmer profile and attendance</p>
        </div>

        {/* Profile and Stats Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Swimmer Profile */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-16 h-16 bg-brand/20 rounded-full flex items-center justify-center">
                <span className="text-brand font-bold text-2xl">
                  {swimmer.first_name[0]}{swimmer.last_name[0]}
                </span>
              </div>
              <div>
                <h3 className="font-serif text-2xl text-white">{swimmer.first_name}</h3>
                <p className="text-text-tertiary text-sm tabular-nums">Age {age}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-text-tertiary text-xs mb-1">Registration number</p>
                <p className="text-white font-medium">{swimmer.se_number || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Date of birth</p>
                <p className="text-white font-medium tabular-nums">{formatDate(swimmer.dob)}</p>
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-1">Gender</p>
                <p className="text-white font-medium">{formatGender(swimmer.gender)}</p>
              </div>
              {swimmer.medical_notes && (
                <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-warning text-xs font-semibold mb-1">Medical notes</p>
                  <p className="text-warning/90 text-sm">{swimmer.medical_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Stats */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <h3 className="font-serif text-2xl text-white mb-6">Attendance</h3>
            {attendanceStats ? (
              <div className="space-y-4">
                <div>
                  <p className="text-text-tertiary text-xs mb-2">Attendance rate</p>
                  <p className={`text-5xl font-bold tabular-nums ${attendanceRateColour(attendanceStats.attendance_rate)}`}>
                    {attendanceStats.attendance_rate}%
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-text-tertiary text-xs mb-1">Total sessions</p>
                    <p className="text-white text-2xl font-bold tabular-nums">{attendanceStats.total_sessions}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs mb-1">Attended</p>
                    <p className="text-success text-2xl font-bold tabular-nums">{attendanceStats.attended}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs mb-1">Absent</p>
                    <p className="text-danger text-2xl font-bold tabular-nums">{attendanceStats.absent}</p>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs mb-1">Late</p>
                    <p className="text-warning text-2xl font-bold tabular-nums">{attendanceStats.late}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-secondary">No attendance data available</p>
            )}
          </div>

          {/* Squad Info */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <h3 className="font-serif text-2xl text-white mb-6">Squad and achievements</h3>
            <div className="space-y-4">
              <div>
                <p className="text-text-tertiary text-xs mb-2">Current squad</p>
                {swimmer.squad_id ? (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-brand/10 text-brand border border-brand/20">
                    Assigned to squad
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-white/5 text-text-tertiary border border-white/10">
                    No squad assigned
                  </span>
                )}
              </div>
              <div>
                <p className="text-text-tertiary text-xs mb-2">Achievements</p>
                <p className="text-text-secondary text-sm">No badges or achievements yet</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Upcoming sessions</h2>
          </div>
          <div className="p-4 md:p-6">
            {upcomingSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="w-12 h-12 text-text-tertiary mb-4" />
                <p className="text-white font-semibold mb-1">No upcoming sessions</p>
                <p className="text-text-secondary text-sm">Sessions will appear here when scheduled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.session_id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-2xl"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-semibold">{session.session_name}</p>
                        <p className="text-text-tertiary text-sm tabular-nums">
                          {formatDate(session.session_date)} at {formatTime(session.start_time)} - {formatTime(session.end_time)}
                        </p>
                        {session.location && (
                          <p className="text-text-tertiary text-sm">{session.location}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-8">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Attendance history</h2>
          </div>
          <div className="p-4 md:p-6">
            {attendanceHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList className="w-12 h-12 text-text-tertiary mb-4" />
                <p className="text-white font-semibold mb-1">No attendance records</p>
                <p className="text-text-secondary text-sm">Attendance will be recorded as sessions take place.</p>
              </div>
            ) : (
              <>
              {/* Mobile card layout */}
              <div className="md:hidden space-y-3">
                {attendanceHistory.map((record) => (
                  <div key={record.attendance_id} className="bg-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-semibold tabular-nums">
                        {record.session?.session_date ? formatDate(record.session.session_date) : 'N/A'}
                      </p>
                      <span className={getStatusBadgeClasses(record.status)}>
                        {getStatusLabel(record.status)}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm">
                      {record.session?.session_name || 'Unknown session'}
                    </p>
                    {record.notes && (
                      <p className="text-text-tertiary text-sm">{record.notes}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-text-tertiary text-sm border-b border-white/10">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Session</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceHistory.map((record) => (
                      <tr key={record.attendance_id} className="border-b border-white/10 last:border-0">
                        <td className="py-4 text-white tabular-nums">
                          {record.session?.session_date ? formatDate(record.session.session_date) : 'N/A'}
                        </td>
                        <td className="py-4 text-white">
                          {record.session?.session_name || 'Unknown session'}
                        </td>
                        <td className="py-4">
                          <span className={getStatusBadgeClasses(record.status)}>
                            {getStatusLabel(record.status)}
                          </span>
                        </td>
                        <td className="py-4 text-text-tertiary text-sm">
                          {record.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>

        {/* Times and Personal Bests: swimming times, feature-flagged off by default (TEM-15) */}
        {isCompetitionsEnabled() && (
          <div className="bg-dark-primary rounded-card shadow-card border border-white/10 mb-8">
            <div className="p-4 md:p-6 border-b border-white/10">
              <h2 className="font-serif text-2xl text-white">Times and personal bests</h2>
            </div>
            <div className="p-4 md:p-6">
              <PersonalBests
                swimmerId={id}
                fetchPersonalBests={fetchSwimmerPersonalBests}
                fetchResults={fetchSwimmerResults}
                emptyMessage="No competition times recorded yet. Times will appear here after their first gala, time trial or meet."
              />
            </div>
          </div>
        )}

        {/* Progress Notes */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10">
          <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-serif text-2xl text-white">Progress notes</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
              Coming soon
            </span>
          </div>
          <div className="p-4 md:p-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="w-12 h-12 text-text-tertiary mb-4" />
              <p className="text-white font-semibold mb-1">Coach feedback on the way</p>
              <p className="text-text-secondary text-sm">Soon, coaches will be able to share progress notes and training feedback here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
