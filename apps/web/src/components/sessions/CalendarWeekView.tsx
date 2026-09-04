'use client';

import { Session, SessionStatus } from '@swim-nexus/shared-types';

import { useFormatters, type Formatters } from '@/hooks/useFormatters';

interface CalendarWeekViewProps {
  sessions: Session[];
  weekStart: Date;
  onSessionClick: (sessionId: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

function getStatusDotClass(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.SCHEDULED:
      return 'bg-brand';
    case SessionStatus.IN_PROGRESS:
      return 'bg-brand';
    case SessionStatus.COMPLETED:
      return 'bg-green-400';
    case SessionStatus.CANCELLED:
      return 'bg-red-400';
    default:
      return 'bg-grey-400';
  }
}

function formatWeekRange(
  weekStart: Date,
  formatDate: Formatters['formatDate'],
): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startMonth = formatDate(weekStart, { month: 'short' });
  const endMonth = formatDate(weekEnd, { month: 'short' });
  const year = weekEnd.getFullYear();

  if (startMonth === endMonth) {
    return `${weekStart.getDate()} - ${weekEnd.getDate()} ${startMonth} ${year}`;
  }
  return `${weekStart.getDate()} ${startMonth} - ${weekEnd.getDate()} ${endMonth} ${year}`;
}

export default function CalendarWeekView({
  sessions,
  weekStart,
  onSessionClick,
  onPreviousWeek,
  onNextWeek,
  onToday,
}: CalendarWeekViewProps) {
  const { formatDate } = useFormatters();
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group sessions by day
  const sessionsByDay = new Map<string, Session[]>();
  days.forEach((day) => {
    const key = day.toISOString().split('T')[0];
    sessionsByDay.set(key, []);
  });

  sessions.forEach((session) => {
    const sessionDate = new Date(session.session_date);
    const key = sessionDate.toISOString().split('T')[0];
    if (sessionsByDay.has(key)) {
      sessionsByDay.get(key)!.push(session);
    }
  });

  // Sort sessions within each day by start time
  sessionsByDay.forEach((daySessions) => {
    daySessions.sort((a, b) => a.start_time.localeCompare(b.start_time));
  });

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl text-white tabular-nums">
          {formatWeekRange(weekStart, formatDate)}
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={onToday}
            className="px-4 py-2 min-h-[44px] bg-white/10 text-white rounded-button font-semibold hover:bg-brand/20 hover:text-brand transition-all border border-white/20"
          >
            Today
          </button>
          <button
            onClick={onPreviousWeek}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/10 text-white rounded-button hover:bg-brand/20 hover:text-brand transition-all border border-white/20"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M15 19l-7-7 7-7"></path>
            </svg>
          </button>
          <button
            onClick={onNextWeek}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/10 text-white rounded-button hover:bg-brand/20 hover:text-brand transition-all border border-white/20"
            aria-label="Next week"
          >
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Week Grid - stacked cards on mobile, 7-column grid on md+ */}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-7 md:gap-2">
        {days.map((day) => {
          const key = day.toISOString().split('T')[0];
          const daySessions = sessionsByDay.get(key) || [];
          const isToday = day.getTime() === today.getTime();
          const isPast = day.getTime() < today.getTime();
          const dayName = formatDate(day, { weekday: 'short' });
          const dayNum = day.getDate();

          return (
            <div
              key={key}
              className={`md:min-h-[200px] rounded-xl border p-3 transition-all ${
                isToday
                  ? 'border-brand/60 bg-brand/5'
                  : isPast
                  ? 'border-white/10 bg-dark-primary/50'
                  : 'border-white/20 bg-dark-primary/80'
              }`}
            >
              {/* Day Header - horizontal on mobile, centred on md+ */}
              <div className="flex items-center gap-2 mb-3 md:block md:text-center">
                <p className={`text-xs font-semibold uppercase ${isToday ? 'text-brand' : 'text-text-tertiary'}`}>
                  {dayName}
                </p>
                <p className={`text-lg font-bold tabular-nums ${
                  isToday ? 'text-brand' : isPast ? 'text-text-tertiary' : 'text-white'
                }`}>
                  {dayNum}
                </p>
              </div>

              {/* Sessions */}
              <div className="space-y-2">
                {daySessions.map((session) => (
                  <button
                    key={session.session_id}
                    onClick={() => onSessionClick(session.session_id)}
                    className="w-full text-left p-2 rounded-lg bg-white/15 border border-white/20 hover:border-brand/40 transition-all group min-h-[44px]"
                  >
                    <div className="flex items-center space-x-1.5 mb-1">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotClass(session.status)}`}></span>
                      <span className="text-xs text-text-secondary truncate tabular-nums">
                        {session.start_time}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-white group-hover:text-brand transition-colors truncate">
                      {session.session_name}
                    </p>
                    {session.squad && (
                      <p className="text-[10px] text-text-tertiary truncate mt-0.5">
                        {session.squad.squad_name}
                      </p>
                    )}
                  </button>
                ))}
                {daySessions.length === 0 && (
                  <p className="text-xs text-text-tertiary text-center py-2">No sessions</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 pt-2">
        {Object.values(SessionStatus).map((status) => (
          <div key={status} className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${getStatusDotClass(status)}`}></span>
            <span className="text-xs text-text-secondary capitalize">
              {status.replace('_', ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
