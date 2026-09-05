'use client';

import { Printer, Calendar } from 'lucide-react';
import { useEffect, useState } from 'react';

import AttendanceRoster from '@/components/attendance/AttendanceRoster';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { useSessions } from '@/lib/hooks';

export default function AttendancePage() {
  const { formatDate } = useFormatters();
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  const { club } = useClubRegion();
  // Print headers show the club's own name; while the club has not loaded
  // (or the fetch failed) they omit the name rather than printing the
  // platform placeholder as if it were the club.
  const clubDisplayName = club?.name ?? '';

  const { data: sessionsData, isLoading: sessionsLoading, error: sessionsError } = useSessions();
  const sessions = sessionsData || [];

  // Auto-select the session closest to now when sessions load
  useEffect(() => {
    if (selectedSessionId || sessions.length === 0) return;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // Find sessions happening today
    const todaySessions = sessions.filter((s) => {
      if (!s.session_date) return false;
      return new Date(s.session_date).toISOString().slice(0, 10) === todayStr;
    });

    if (todaySessions.length > 0) {
      // Among today's sessions, pick the one closest to now (prefer upcoming over past)
      let best = todaySessions[0];
      let bestScore = Infinity;

      for (const s of todaySessions) {
        const [h, m] = (s.start_time || '00:00').split(':').map(Number);
        const sessionMinutes = h * 60 + m;
        const diff = sessionMinutes - nowMinutes;
        // Upcoming sessions score by their positive diff; past sessions score higher (less preferred)
        const score = diff >= 0 ? diff : Math.abs(diff) + 1440;
        if (score < bestScore) {
          bestScore = score;
          best = s;
        }
      }

      setSelectedSessionId(best.session_id);
      return;
    }

    // No sessions today, so pick the next upcoming session
    const futureSessions = sessions
      .filter((s) => s.session_date && new Date(s.session_date) >= new Date(todayStr))
      .sort((a, b) => {
        const dateDiff = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return (a.start_time || '').localeCompare(b.start_time || '');
      });

    if (futureSessions.length > 0) {
      setSelectedSessionId(futureSessions[0].session_id);
    }
  }, [sessions, selectedSessionId]);

  const selectedSession = sessions.find((s) => s.session_id === selectedSessionId);

  return (
    <MainLayout>
      {/* Print styles for attendance page */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          .attendance-page {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            max-width: none !important;
          }
          .attendance-page .max-w-3xl {
            max-width: none !important;
          }
          .attendance-page .no-print {
            display: none !important;
          }
          .attendance-page .print-only {
            display: block !important;
          }

          /* Print header */
          .attendance-print-header {
            display: block !important;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid black;
          }
          .attendance-print-header h1 {
            font-size: 1.5rem;
            font-weight: bold;
            color: black;
            margin: 0 0 0.125rem;
          }
          .attendance-print-header .print-header-subtitle {
            font-size: 0.8125rem;
            color: #333;
            margin: 0;
          }
          .attendance-print-header .print-header-meta {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-top: 0.25rem;
            font-size: 0.75rem;
            color: #555;
          }

          /* Roster table */
          .print-roster-table {
            display: table !important;
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            margin-top: 0.5rem;
          }
          .print-roster-table th,
          .print-roster-table td {
            border: 1px solid #666;
            padding: 7px 10px;
            text-align: left;
            color: black;
          }
          .print-roster-table th {
            background-color: #e5e5e5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: 600;
            font-size: 0.8125rem;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }
          .print-roster-table tbody tr:nth-child(even) {
            background-color: #f5f5f5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-roster-table tbody tr {
            break-inside: avoid;
          }

          /* Checkbox column */
          .print-roster-table .print-checkbox-cell {
            width: 28px;
            text-align: center;
            padding: 7px 4px;
          }
          .print-checkbox {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 1.5px solid #333;
            vertical-align: middle;
          }
          .print-checkbox-checked {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 1.5px solid #333;
            vertical-align: middle;
            position: relative;
            text-align: center;
            line-height: 14px;
            font-size: 11px;
            font-weight: bold;
          }

          /* Status column: narrow */
          .print-roster-table .print-status-cell {
            width: 80px;
            font-size: 0.8125rem;
          }

          /* Notes column */
          .print-roster-table .print-notes-cell {
            width: 30%;
          }

          /* Print footer */
          .attendance-print-footer {
            display: block !important;
            margin-top: 1.5rem;
            padding-top: 0.5rem;
            border-top: 1px solid #999;
            font-size: 0.6875rem;
            color: #666 !important;
          }
          .attendance-print-footer .print-footer-inner {
            display: flex;
            justify-content: space-between;
          }

          /* Print key/legend */
          .attendance-print-key {
            display: block !important;
            margin-top: 1rem;
            font-size: 0.75rem;
            color: #444 !important;
          }
          .attendance-print-key span {
            margin-right: 1.5rem;
          }
        }
      `,
        }}
      />
      <div className="attendance-page min-h-full bg-canvas p-4 md:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="no-print">
            <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Attendance' }]} />
          </div>

          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl md:text-4xl text-dark-primary mb-1 no-print">
                Attendance
              </h1>
              <p className="text-grey-600 text-lg no-print">
                Track swimmer attendance for each session
              </p>
            </div>
            {selectedSession && (
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print shrink-0 flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl text-sm font-semibold text-white border border-grey-200 bg-dark-primary/80 hover:bg-dark-primary hover:border-brand/40 transition-all"
                title="Print register"
              >
                <Printer className="w-5 h-5" />
                Print register
              </button>
            )}
          </div>

          {/* Print-only header with session details (hidden on screen, revealed by print stylesheet) */}
          {selectedSession && (
            <div className="attendance-print-header hidden">
              <h1>Attendance Register - {selectedSession.session_name}</h1>
              <p className="print-header-subtitle">
                {selectedSession.session_date &&
                  formatDate(selectedSession.session_date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                {selectedSession.start_time && ` | ${selectedSession.start_time}`}
                {selectedSession.end_time && ` \u2013 ${selectedSession.end_time}`}
                {selectedSession.squad?.squad_name && ` | ${selectedSession.squad.squad_name}`}
                {selectedSession.location && ` | ${selectedSession.location}`}
              </p>
              <div className="print-header-meta">
                <span>{clubDisplayName}</span>
              </div>
            </div>
          )}

          {/* Session Selector */}
          <div className="mb-6 no-print">
            <label
              htmlFor="session-select"
              className="block text-sm font-medium text-text-secondary mb-2"
            >
              Select Session
            </label>
            {sessionsLoading ? (
              <div className="w-full h-14 rounded-xl border border-white/20 flex items-center px-4 bg-dark-primary/80">
                <span className="text-white/80 text-base">Loading sessions...</span>
              </div>
            ) : sessionsError ? (
              <div className="w-full h-14 rounded-xl border border-danger/20 flex items-center px-4 bg-danger/10">
                <span className="text-danger text-base">Failed to load sessions</span>
              </div>
            ) : (
              <div className="flex gap-3">
                <select
                  id="session-select"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="flex-1 h-14 px-4 rounded-xl border border-white/20 bg-dark-primary/80 text-white text-base appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand transition-colors"
                >
                  <option value="">-- Choose a session --</option>
                  {sessions.map((session) => (
                    <option key={session.session_id} value={session.session_id}>
                      {session.session_name}
                      {session.session_date
                        ? ` - ${formatDate(session.session_date, { weekday: 'short', day: 'numeric', month: 'short' })}`
                        : ''}
                      {session.start_time ? ` ${session.start_time}` : ''}
                      {session.squad?.squad_name ? ` (${session.squad.squad_name})` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const todayStr = now.toISOString().slice(0, 10);
                    const todaySessions = sessions.filter((s) => {
                      if (!s.session_date) return false;
                      return new Date(s.session_date).toISOString().slice(0, 10) === todayStr;
                    });
                    if (todaySessions.length > 0) {
                      const nowMinutes = now.getHours() * 60 + now.getMinutes();
                      let best = todaySessions[0];
                      let bestScore = Infinity;
                      for (const s of todaySessions) {
                        const [h, m] = (s.start_time || '00:00').split(':').map(Number);
                        const sessionMinutes = h * 60 + m;
                        const diff = sessionMinutes - nowMinutes;
                        const score = diff >= 0 ? diff : Math.abs(diff) + 1440;
                        if (score < bestScore) {
                          bestScore = score;
                          best = s;
                        }
                      }
                      setSelectedSessionId(best.session_id);
                    }
                  }}
                  className="shrink-0 px-5 h-14 min-h-[44px] rounded-xl border border-white/20 bg-brand text-dark-primary font-semibold hover:bg-brand-light transition-colors flex items-center gap-2"
                  title="Jump to today's sessions"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="hidden sm:inline">Today</span>
                </button>
              </div>
            )}
          </div>

          {/* Session info card */}
          {selectedSession && (
            <div className="mb-6 p-4 rounded-3xl border border-grey-200 bg-dark-primary/80 shadow-lg no-print">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="text-white font-semibold text-lg">{selectedSession.session_name}</p>
                  <p className="text-text-secondary text-sm mt-0.5">
                    {selectedSession.session_date &&
                      formatDate(selectedSession.session_date, {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    {selectedSession.start_time && ` · ${selectedSession.start_time}`}
                    {selectedSession.end_time && `-${selectedSession.end_time}`}
                  </p>
                </div>
                <div className="sm:text-right">
                  {selectedSession.squad?.squad_name && (
                    <span className="inline-block px-3 py-1 rounded-lg text-sm font-medium bg-brand/10 text-brand">
                      {selectedSession.squad.squad_name}
                    </span>
                  )}
                  {selectedSession.location && (
                    <p className="text-text-tertiary text-xs mt-1">{selectedSession.location}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Roster */}
          {selectedSessionId && (
            <AttendanceRoster
              sessionId={selectedSessionId}
              sessionName={selectedSession?.session_name ?? ''}
              squadName={selectedSession?.squad?.squad_name ?? ''}
            />
          )}

          {/* Print-only attendance key */}
          {selectedSession && (
            <div className="attendance-print-key hidden">
              <strong>Key:</strong> <span>P = Present</span>
              <span>L = Late</span>
              <span>A = Absent</span>
              <span>E = Excused</span>
            </div>
          )}

          {/* Print-only footer */}
          {selectedSession && (
            <div className="attendance-print-footer hidden">
              <div className="print-footer-inner">
                <span>
                  {clubDisplayName ? (
                    <>{clubDisplayName} &middot; Attendance Register</>
                  ) : (
                    'Attendance Register'
                  )}
                </span>
                <span>
                  Printed{' '}
                  {formatDate(new Date(), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Empty state - no sessions available */}
          {!sessionsLoading && !sessionsError && sessions.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No sessions yet"
              description="Attendance tracking starts here. Create a training session and you can mark swimmers present or absent from your phone poolside."
              hint="Registers work offline and sync when you are back in Wi-Fi range."
              actionLabel="Create Session"
              actionHref="/sessions"
            />
          )}

          {/* Empty state - no session selected */}
          {!selectedSessionId && sessions.length > 0 && (
            <div className="mt-8">
              <EmptyState
                icon={Calendar}
                title="Select a session"
                description="Choose a session from the dropdown above to view or update the attendance register."
              />
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
