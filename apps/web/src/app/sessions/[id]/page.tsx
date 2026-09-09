'use client';

import { SessionStatus } from '@club-manager/shared-types';
import { Calendar } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import AttendanceTracker from '@/components/sessions/AttendanceTracker';
import SessionModal from '@/components/sessions/SessionModal';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { updateSession, updateSessionStatus } from '@/lib/api/sessions';
import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { useSessionDetail } from '@/lib/hooks';

function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

function getStatusBadgeClass(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.SCHEDULED:
      return 'bg-brand/20 text-brand border-brand/40';
    case SessionStatus.IN_PROGRESS:
      return 'bg-dark-primary/20 text-brand border-brand/40';
    case SessionStatus.COMPLETED:
      return 'bg-green-500/20 text-green-400 border-green-500/40';
    case SessionStatus.CANCELLED:
      return 'bg-red-500/20 text-red-400 border-red-500/40';
    default:
      return 'bg-white/20 text-white/60 border-white/20';
  }
}

function formatStatus(status: string): string {
  return status.replace('_', ' ');
}

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const {
    data: session,
    isLoading,
    error: sessionError,
    refetch: fetchSession,
  } = useSessionDetail(sessionId);
  const { formatDate } = useFormatters();
  const formatSessionDate = (dateStr: string) =>
    formatDate(dateStr, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateStatus = async (status: SessionStatus) => {
    if (!session) return;

    try {
      setError(null);
      await updateSessionStatus(session.session_id, status);
      fetchSession();
      toast.success('Session status updated');
    } catch (err) {
      setError('Failed to update session status');
      toast.error('Failed to update session status');
    }
  };

  const handleOpenEditModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (data: {
    session_name: string;
    session_date: string;
    start_time: string;
    end_time: string;
    squad_id: string;
    location?: string;
    description?: string;
    coach_name?: string;
    max_participants?: number | null;
    status: SessionStatus;
  }) => {
    if (!session) return;

    try {
      setIsSubmitting(true);
      setError(null);
      await updateSession(session.session_id, data);
      fetchSession();
      handleCloseModal();
      toast.success('Session updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update session';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <LoadingSpinner message="Loading session details..." />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (sessionError && !session) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <ErrorState message={sessionError} onRetry={fetchSession} />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <EmptyState
              icon={Calendar}
              title="Session not found"
              description="This session may have been deleted or the link is incorrect."
              actionLabel="Back to Sessions"
              actionHref="/sessions"
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Sessions', href: '/sessions' },
              { label: session.session_name },
            ]}
          />

          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="font-serif text-4xl text-dark-primary mb-3">
                  {session.session_name}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold border ${getStatusBadgeClass(
                      session.status
                    )}`}
                  >
                    {formatStatus(session.status)}
                  </span>
                  {session.squad && (
                    <span className="text-grey-500 text-lg">{session.squad.squad_name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/attendance"
                  className="px-5 py-3 min-h-[44px] bg-white/5 text-white rounded-xl font-semibold hover:bg-brand/20 hover:text-brand transition-all border border-white/20 flex items-center space-x-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                  </svg>
                  <span>Attendance</span>
                </Link>
                <button
                  onClick={handleOpenEditModal}
                  className="px-5 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm"
                >
                  Edit Session
                </button>
              </div>
            </div>
          </div>

          {/* Error Message (mutation errors, or a background refetch failure while details remain on screen) */}
          {(error || sessionError) && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl">
              <p className="text-red-400 font-semibold">{error || sessionError}</p>
            </div>
          )}

          {/* Session Details Card */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-8 border border-white/20 mb-8">
            <h2 className="font-serif text-3xl text-white mb-6">Session Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div className="flex items-start space-x-3">
                  <svg
                    className="w-5 h-5 text-brand mt-1 flex-shrink-0"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <div>
                    <p className="text-text-tertiary text-sm mb-1">Date</p>
                    <p className="text-white text-lg font-semibold">
                      {formatSessionDate(session.session_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <svg
                    className="w-5 h-5 text-brand mt-1 flex-shrink-0"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <p className="text-text-tertiary text-sm mb-1">Time</p>
                    <p className="text-white text-lg font-semibold tabular-nums">
                      {formatTimeRange(session.start_time, session.end_time)}
                    </p>
                  </div>
                </div>
                {session.location && (
                  <div className="flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-brand mt-1 flex-shrink-0"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                      <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <div>
                      <p className="text-text-tertiary text-sm mb-1">Location</p>
                      <p className="text-white text-lg font-semibold">{session.location}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-5">
                {session.coach_name && (
                  <div className="flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-brand mt-1 flex-shrink-0"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <div>
                      <p className="text-text-tertiary text-sm mb-1">Coach</p>
                      <p className="text-white text-lg font-semibold">{session.coach_name}</p>
                    </div>
                  </div>
                )}
                {session.max_participants && (
                  <div className="flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-brand mt-1 flex-shrink-0"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    <div>
                      <p className="text-text-tertiary text-sm mb-1">Capacity</p>
                      <p className="text-white text-lg font-semibold tabular-nums">
                        {session.max_participants} {MEMBER_NOUN_PLURAL_LOWER}
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-text-tertiary text-sm mb-2">Status</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {Object.values(SessionStatus).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleUpdateStatus(status)}
                        disabled={session.status === status}
                        className={`px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          session.status === status
                            ? getStatusBadgeClass(status)
                            : 'bg-white/5 text-text-secondary border-white/20 hover:border-brand/40'
                        }`}
                      >
                        {formatStatus(status)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {session.description && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <p className="text-text-tertiary text-sm mb-2">Notes</p>
                <p className="text-white text-lg">{session.description}</p>
              </div>
            )}
          </div>

          {/* Attendance Tracker */}
          {session.squad_id && (
            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-8 border border-white/20">
              <AttendanceTracker
                sessionId={session.session_id}
                squadId={session.squad_id}
                onUpdate={fetchSession}
              />
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <SessionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        session={session}
        isLoading={isSubmitting}
      />
    </MainLayout>
  );
}
