'use client';

import { Session, SessionStatus } from '@club-manager/shared-types';
import { Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import CalendarWeekView from '@/components/sessions/CalendarWeekView';
import SessionModal from '@/components/sessions/SessionModal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useFormatters } from '@/hooks/useFormatters';
import { createSession, updateSession, deleteSession } from '@/lib/api/sessions';
import { useSessions } from '@/lib/hooks/useSessions';
import { useSquads } from '@/lib/hooks/useSquads';

type ViewMode = 'list' | 'calendar';

// Parse a date-only string (e.g. '2026-03-31') as local midnight.
// new Date('2026-03-31') parses as UTC midnight which shifts to the
// previous day in BST/GMT+1, so we split and construct explicitly.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

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

function groupSessionsByDate(sessions: Session[]): { [key: string]: Session[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const groups: { [key: string]: Session[] } = {
    Today: [],
    Tomorrow: [],
    'This Week': [],
    Later: [],
  };

  sessions.forEach((session) => {
    const sessionDate = parseLocalDate(session.session_date);

    if (sessionDate.getTime() === today.getTime()) {
      groups.Today.push(session);
    } else if (sessionDate.getTime() === tomorrow.getTime()) {
      groups.Tomorrow.push(session);
    } else if (sessionDate <= weekFromNow) {
      groups['This Week'].push(session);
    } else {
      groups.Later.push(session);
    }
  });

  return groups;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

export default function SessionsPage() {
  const router = useRouter();
  const {
    data: sessionsData,
    isLoading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useSessions();
  const { data: squadsData, isLoading: squadsLoading } = useSquads();
  const sessions = useMemo(() => sessionsData ?? [], [sessionsData]);
  const squads = squadsData ?? [];
  const isLoading = sessionsLoading || squadsLoading;

  const { formatDate } = useFormatters();
  const formatSessionDate = (dateStr: string) =>
    formatDate(parseLocalDate(dateStr), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [selectedSquadFilter, setSelectedSquadFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const error = sessionsError || mutationError;

  const handleOpenAddModal = () => {
    setSelectedSession(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (session: Session) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSession(null);
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
    try {
      setIsSubmitting(true);
      setMutationError(null);

      if (selectedSession) {
        await updateSession(selectedSession.session_id, data);
        toast.success('Session updated successfully');
      } else {
        await createSession(data);
        toast.success('Session created successfully');
      }

      refetchSessions();
      handleCloseModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save session';
      setMutationError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (sessionId: string) => {
    setPendingSessionId(sessionId);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingSessionId) return;
    try {
      setIsDeleting(true);
      await deleteSession(pendingSessionId);
      refetchSessions();
      toast.success('Session deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete session';
      setMutationError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
      setPendingSessionId(null);
    }
  };

  const handleViewSession = (sessionId: string) => {
    router.push(`/sessions/${sessionId}`);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedSquadFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = searchQuery || selectedSquadFilter || dateFrom || dateTo;

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((session) => {
        if (selectedSquadFilter && session.squad_id !== selectedSquadFilter) {
          return false;
        }
        if (dateFrom) {
          const sessionDate = parseLocalDate(session.session_date);
          const fromDate = parseLocalDate(dateFrom);
          if (sessionDate < fromDate) return false;
        }
        if (dateTo) {
          const sessionDate = parseLocalDate(session.session_date);
          const toDate = parseLocalDate(dateTo);
          if (sessionDate > toDate) return false;
        }
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            session.session_name.toLowerCase().includes(query) ||
            session.location?.toLowerCase().includes(query) ||
            session.squad?.squad_name?.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateCompare =
          parseLocalDate(a.session_date).getTime() - parseLocalDate(b.session_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [sessions, selectedSquadFilter, dateFrom, dateTo, searchQuery]);

  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  const upcomingSessions = filteredSessions.filter(
    (s) => s.status === SessionStatus.SCHEDULED || s.status === SessionStatus.IN_PROGRESS
  );

  // Count sessions in the current Monday-Sunday week
  const thisWeekCount = useMemo(() => {
    const monday = getMonday(new Date());
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sessions.filter((s) => {
      const d = parseLocalDate(s.session_date);
      return d >= monday && d <= sunday;
    }).length;
  }, [sessions]);

  // Calendar week sessions
  const calendarSessions = useMemo(() => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return filteredSessions.filter((session) => {
      const sessionDate = parseLocalDate(session.session_date);
      return sessionDate >= weekStart && sessionDate <= weekEnd;
    });
  }, [filteredSessions, weekStart]);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-4xl text-dark-primary mb-2">Sessions</h1>
              <p className="text-grey-600 text-lg">Manage training sessions and track attendance</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-lg"
            >
              <span>Add Session</span>
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 4v16m8-8H4"></path>
              </svg>
            </button>
          </div>

          {/* Error Message */}
          {error && <ErrorState message={error} onRetry={refetchSessions} />}

          {/* Stats Card */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">Upcoming Sessions</p>
                <h2 className="text-3xl sm:text-6xl md:text-8xl font-bold text-dark-primary mb-4 tabular-nums">
                  {upcomingSessions.length}
                  <span className="text-3xl sm:text-4xl">+</span>
                </h2>
                <p className="text-grey-600 text-lg">Scheduled Training Sessions</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center min-w-[140px] sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Total Sessions</p>
                  <p className="text-dark-primary text-3xl sm:text-4xl font-bold tabular-nums">
                    {sessions.length}
                  </p>
                </div>
                <div className="bg-white rounded-3xl p-4 sm:p-6 text-center min-w-[140px] sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">This Week</p>
                  <p className="text-dark-primary text-3xl sm:text-4xl font-bold tabular-nums">
                    {thisWeekCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* View Toggle + Filters */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-6 border border-white/20 mb-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center bg-white/5 rounded-button p-1">
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-button font-semibold text-sm transition-all ${
                    viewMode === 'list'
                      ? 'bg-brand text-dark-primary shadow-sm'
                      : 'text-grey-300 hover:text-white'
                  }`}
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
                    <path d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                  </svg>
                  <span className="hidden sm:inline">List</span>
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  aria-label="Calendar view"
                  className={`flex items-center space-x-2 px-4 py-2 min-h-[44px] rounded-button font-semibold text-sm transition-all ${
                    viewMode === 'calendar'
                      ? 'bg-brand text-dark-primary shadow-sm'
                      : 'text-grey-300 hover:text-white'
                  }`}
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
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                  <span className="hidden sm:inline">Week</span>
                </button>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 min-h-[44px] text-sm font-semibold text-text-secondary hover:text-brand transition-all"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-semibold text-white mb-2">
                  Search Sessions
                </label>
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, location, or squad..."
                  className="w-full px-4 py-3 min-h-[44px] bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="squad-filter"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Filter by Squad
                </label>
                <select
                  id="squad-filter"
                  value={selectedSquadFilter}
                  onChange={(e) => setSelectedSquadFilter(e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                >
                  <option value="">All Squads</option>
                  {squads.map((squad) => (
                    <option key={squad.squad_id} value={squad.squad_id}>
                      {squad.squad_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="date-from" className="block text-sm font-semibold text-white mb-2">
                  From Date
                </label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                />
              </div>
              <div>
                <label htmlFor="date-to" className="block text-sm font-semibold text-white mb-2">
                  To Date
                </label>
                <input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-4 py-3 min-h-[44px] bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sessions Content */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            {isLoading ? (
              <TableSkeleton />
            ) : viewMode === 'calendar' ? (
              <CalendarWeekView
                sessions={calendarSessions}
                weekStart={weekStart}
                onSessionClick={handleViewSession}
                onPreviousWeek={() => {
                  const prev = new Date(weekStart);
                  prev.setDate(prev.getDate() - 7);
                  setWeekStart(prev);
                }}
                onNextWeek={() => {
                  const next = new Date(weekStart);
                  next.setDate(next.getDate() + 7);
                  setWeekStart(next);
                }}
                onToday={() => setWeekStart(getMonday(new Date()))}
              />
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No sessions yet"
                description="Sessions are your weekly training schedule. Add one and you can take attendance poolside."
                hint="Set up recurring sessions to save time each week."
                actionLabel="Create Session"
                actionOnClick={handleOpenAddModal}
              />
            ) : filteredSessions.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No sessions found"
                description="No sessions match your current filters"
                actionLabel="Clear Filters"
                actionOnClick={handleClearFilters}
              />
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedSessions).map(([groupName, groupSessions]) => {
                  if (groupSessions.length === 0) return null;
                  return (
                    <div key={groupName}>
                      <h3 className="font-serif text-3xl text-white mb-4">{groupName}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupSessions.map((session) => (
                          <div
                            key={session.session_id}
                            className="p-5 sm:p-6 bg-white/5 rounded-2xl hover:border-brand transition-all cursor-pointer group"
                            onClick={() => handleViewSession(session.session_id)}
                          >
                            {/* Session Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h4 className="font-bold text-lg sm:text-xl text-white mb-2 group-hover:text-brand transition-colors">
                                  {session.session_name}
                                </h4>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                                      session.status
                                    )}`}
                                  >
                                    {session.status.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Session Details */}
                            <div className="space-y-3 mb-4">
                              <div className="flex items-center text-sm">
                                <svg
                                  className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <span className="text-text-secondary">
                                  {formatSessionDate(session.session_date)}
                                </span>
                              </div>

                              <div className="flex items-center text-sm">
                                <svg
                                  className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span className="text-text-secondary tabular-nums">
                                  {formatTimeRange(session.start_time, session.end_time)}
                                </span>
                              </div>

                              {session.squad && (
                                <div className="flex items-center text-sm">
                                  <svg
                                    className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                  </svg>
                                  <span className="text-text-secondary">
                                    {session.squad.squad_name}
                                  </span>
                                </div>
                              )}

                              {session.location && (
                                <div className="flex items-center text-sm">
                                  <svg
                                    className="w-5 h-5 mr-2 text-brand flex-shrink-0"
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
                                  <span className="text-text-secondary">{session.location}</span>
                                </div>
                              )}

                              {session.coach_name && (
                                <div className="flex items-center text-sm">
                                  <svg
                                    className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                  </svg>
                                  <span className="text-text-secondary">{session.coach_name}</span>
                                </div>
                              )}
                            </div>

                            {/* Attendance Info */}
                            {session.attendance_count !== undefined &&
                              session.total_members !== undefined && (
                                <div className="mb-4">
                                  <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-text-secondary">Attendance</span>
                                    <span className="text-white font-semibold tabular-nums">
                                      {session.attendance_count} / {session.total_members}
                                    </span>
                                  </div>
                                  {session.total_members > 0 && (
                                    <div className="w-full bg-dark-primary rounded-full h-2">
                                      <div
                                        className="bg-brand rounded-full h-2 transition-all"
                                        style={{
                                          width: `${(session.attendance_count / session.total_members) * 100}%`,
                                        }}
                                      ></div>
                                    </div>
                                  )}
                                </div>
                              )}

                            {/* Action buttons */}
                            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenEditModal(session)}
                                className="flex-1 px-4 py-2 min-h-[44px] bg-brand text-dark-primary rounded-button font-semibold hover:bg-brand-light transition-all"
                              >
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteClick(session.session_id);
                                }}
                                className="px-4 py-2 min-h-[44px] bg-dark-primary text-text-secondary rounded-button font-semibold hover:bg-red-500 hover:text-white transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      <SessionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        session={selectedSession}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete session"
        description="Are you sure you want to delete this session? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
      />
    </MainLayout>
  );
}
