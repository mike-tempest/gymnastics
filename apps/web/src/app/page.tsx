'use client';

import { Member, Session, Family, InvoiceStatus } from '@club-manager/shared-types';
import { UserPlus, Receipt, Users, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import MainLayout from '@/components/layout/MainLayout';
import { useFormatters, type Formatters } from '@/hooks/useFormatters';
import { getFamilies } from '@/lib/api/families';
import { getFinanceDashboard, FinanceDashboard, getOverdueInvoices, InvoiceWithDetails } from '@/lib/api/finance';
import { getMembers } from '@/lib/api/members';
import { getUpcomingSessions, getRecentSessions } from '@/lib/api/sessions';
import { MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

// Activity Feed Types
type ActivityType = 'member_joined' | 'invoice_paid' | 'session_completed';

interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: Date;
  title: string;
  subtitle: string;
  icon: 'user' | 'receipt' | 'users';
  colour: 'green' | 'blue' | 'purple';
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return `${Math.floor(diffInSeconds / 604800)}w ago`;
}

function buildActivityFeed(
  members: Member[],
  invoices: InvoiceWithDetails[],
  sessions: Session[],
  formatCurrency: Formatters['formatCurrency'],
  formatDate: Formatters['formatDate'],
): ActivityItem[] {
  const activities: ActivityItem[] = [];

  // Add member registrations
  members.forEach((member) => {
    activities.push({
      id: `member-${member.member_id}`,
      type: 'member_joined',
      timestamp: new Date(member.created_at),
      title: `${member.first_name} ${member.last_name} joined the club`,
      subtitle: `New ${MEMBER_NOUN_LOWER} registration`,
      icon: 'user',
      colour: 'green',
    });
  });

  // Add paid invoices
  invoices
    .filter((inv) => inv.status === InvoiceStatus.PAID && inv.updated_at)
    .forEach((invoice) => {
      const amount = formatCurrency(invoice.total_amount || 0, invoice.currency);
      const familyName = invoice.family?.family_name || 'Unknown family';
      activities.push({
        id: `invoice-${invoice.invoice_id}`,
        type: 'invoice_paid',
        timestamp: new Date(invoice.updated_at),
        title: `Invoice ${invoice.invoice_number} paid (${amount})`,
        subtitle: familyName,
        icon: 'receipt',
        colour: 'blue',
      });
    });

  // Add completed sessions with attendance
  sessions
    .filter((session) => session.status === 'completed' && session.attendance_count !== undefined)
    .forEach((session) => {
      const attended = session.attendance_count ?? 0;
      const total = session.total_members ?? 0;
      activities.push({
        id: `session-${session.session_id}`,
        type: 'session_completed',
        timestamp: new Date(session.updated_at),
        title: `${session.session_name} session completed (${attended}/${total} attended)`,
        subtitle: formatDate(session.session_date, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        icon: 'users',
        colour: 'purple',
      });
    });

  // Sort by timestamp descending (most recent first)
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function formatSessionTime(
  session: Session,
  formatDate: Formatters['formatDate'],
): string {
  const dayName = formatDate(session.session_date, { weekday: 'short' });
  const dayMonth = formatDate(session.session_date, { day: 'numeric', month: 'short' });
  return `${dayName} ${dayMonth}, ${session.start_time}`;
}

function calculateAttendanceRate(sessions: Session[]): number {
  const sessionsWithAttendance = sessions.filter(
    (s) => s.attendance_count !== undefined && s.total_members !== undefined && s.total_members > 0
  );
  if (sessionsWithAttendance.length === 0) return 0;
  const totalAttended = sessionsWithAttendance.reduce((sum, s) => sum + (s.attendance_count ?? 0), 0);
  const totalExpected = sessionsWithAttendance.reduce((sum, s) => sum + (s.total_members ?? 0), 0);
  return totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : 0;
}

export default function Home() {
  const { formatCurrency, formatDate } = useFormatters();
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [financeDashboard, setFinanceDashboard] = useState<FinanceDashboard | null>(null);
  const [overdueInvoices, setOverdueInvoices] = useState<InvoiceWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true);
        const [membersData, familiesData, sessionsData, recentData, financeDashboardData, overdueData] = await Promise.all([
          getMembers(),
          getFamilies(),
          getUpcomingSessions(),
          getRecentSessions(),
          getFinanceDashboard().catch((err) => {
            console.error('Failed to load finance dashboard', err);
            return null;
          }),
          getOverdueInvoices().catch((err) => {
            console.error('Failed to load overdue invoices', err);
            return [] as InvoiceWithDetails[];
          }),
        ]);
        setMembers(membersData);
        setFamilies(familiesData);
        setUpcomingSessions(sessionsData.slice(0, 5));
        setRecentSessions(recentData);
        setFinanceDashboard(financeDashboardData);
        setOverdueInvoices(overdueData);
        setError(null);
      } catch {
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const totalMembers = members.length;
  const activeFamilies = families.length;
  const overdueCount = overdueInvoices.length;
  const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const attendanceRate = calculateAttendanceRate(recentSessions);
  const monthlyRevenue = financeDashboard
    ? formatCurrency(financeDashboard.this_month_revenue)
    : null;

  // Helper: show dash when data failed to load
  const unavailable = '—';

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-6xl mx-auto">

          {/* Editorial Header */}
          <div className="mb-12">
            <h1 className="font-serif text-3xl sm:text-5xl md:text-7xl text-dark-primary tracking-tight mb-3">
              Dashboard
            </h1>
            <p className="text-lg text-grey-600 max-w-xl">
              Your club at a glance. Track members, sessions, and finances in one place.
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-8 p-6 bg-danger/10 border border-danger/30 rounded-3xl text-danger">
              <p className="font-semibold">Something went wrong</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Primary Metrics - Dark Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Members */}
            <div className="bg-dark-primary rounded-3xl p-8 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-brand/10 rounded-full -translate-y-4 translate-x-4 sm:-translate-y-8 sm:translate-x-8" />
              <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-4">{MEMBER_NOUN_PLURAL}</p>
              {isLoading ? (
                <div className="animate-pulse bg-white/10 rounded h-16 w-24" />
              ) : error ? (
                <p className="text-white text-6xl font-serif">{unavailable}</p>
              ) : totalMembers === 0 ? (
                <div>
                  <p className="text-white/80 text-sm mb-2">No {MEMBER_NOUN_PLURAL_LOWER} registered yet</p>
                  <Link href="/members" className="inline-block text-brand text-sm font-semibold hover:underline">
                    Add your first member &rarr;
                  </Link>
                </div>
              ) : (
                <p className="text-white text-6xl font-serif tabular-nums">{totalMembers}</p>
              )}
              {totalMembers > 0 && (
                <Link href="/members" className="mt-6 inline-block text-white/70 text-sm hover:text-brand transition-colors">
                  View all &rarr;
                </Link>
              )}
            </div>

            {/* Families */}
            <div className="bg-dark-primary rounded-3xl p-8 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-brand/10 rounded-full -translate-y-4 translate-x-4 sm:-translate-y-8 sm:translate-x-8" />
              <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-4">Families</p>
              {isLoading ? (
                <div className="animate-pulse bg-white/10 rounded h-16 w-24" />
              ) : error ? (
                <p className="text-white text-6xl font-serif">{unavailable}</p>
              ) : activeFamilies === 0 ? (
                <div>
                  <p className="text-white/80 text-sm mb-2">No families added yet</p>
                  <Link href="/families" className="inline-block text-brand text-sm font-semibold hover:underline">
                    Register a family &rarr;
                  </Link>
                </div>
              ) : (
                <p className="text-white text-6xl font-serif tabular-nums">{activeFamilies}</p>
              )}
              {activeFamilies > 0 && (
                <Link href="/families" className="mt-6 inline-block text-white/70 text-sm hover:text-brand transition-colors">
                  View all &rarr;
                </Link>
              )}
            </div>

            {/* Revenue */}
            <div className="bg-dark-primary rounded-3xl p-8 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-brand/10 rounded-full -translate-y-4 translate-x-4 sm:-translate-y-8 sm:translate-x-8" />
              <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-4">This Month</p>
              {isLoading ? (
                <div className="animate-pulse bg-white/10 rounded h-16 w-32" />
              ) : error ? (
                <>
                  <p className="text-white text-5xl font-serif">{unavailable}</p>
                  <p className="mt-6 text-white/70 text-sm">Unable to load</p>
                </>
              ) : !monthlyRevenue || (financeDashboard && financeDashboard.paid_invoices === 0 && Number(financeDashboard.this_month_revenue) === 0) ? (
                <div>
                  <p className="text-white/80 text-sm mb-2">No billing activity yet</p>
                  <Link href="/billing" className="inline-block text-brand text-sm font-semibold hover:underline">
                    Set up billing &rarr;
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-white text-5xl font-serif tabular-nums">{monthlyRevenue}</p>
                  <p className="mt-6 text-white/70 text-sm">
                    {financeDashboard ? `${financeDashboard.paid_invoices} invoices paid` : 'No data yet'}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Secondary Metrics - Light Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {/* Attendance */}
            <div className="bg-surface rounded-3xl p-8 border border-grey-200">
              <p className="text-grey-400 text-sm font-medium uppercase tracking-wider mb-3">Attendance</p>
              {isLoading ? (
                <div className="animate-pulse bg-canvas-dark/20 rounded h-12 w-20" />
              ) : error ? (
                <p className="text-dark-primary text-5xl font-serif">{unavailable}</p>
              ) : attendanceRate === 0 ? (
                <p className="text-dark-primary/60 text-sm mt-2">No attendance recorded this week</p>
              ) : (
                <p className="text-dark-primary text-5xl font-serif tabular-nums">{attendanceRate}%</p>
              )}
              <p className="mt-3 text-grey-400 text-sm">This week</p>
            </div>

            {/* Upcoming Sessions */}
            <div className="bg-surface rounded-3xl p-8 border border-grey-200">
              <p className="text-grey-400 text-sm font-medium uppercase tracking-wider mb-3">Upcoming</p>
              {isLoading ? (
                <div className="animate-pulse bg-canvas-dark/20 rounded h-12 w-16" />
              ) : (
                <p className="text-dark-primary text-5xl font-serif tabular-nums">{error ? unavailable : upcomingSessions.length}</p>
              )}
              <Link href="/sessions" className="mt-3 inline-block text-grey-400 text-sm hover:text-dark-primary transition-colors">
                Sessions this week &rarr;
              </Link>
            </div>

            {/* Overdue */}
            <div className={`rounded-3xl p-8 border ${overdueCount > 0 ? 'bg-danger/10 border-danger/20' : 'bg-surface border-grey-200'}`}>
              <p className="text-grey-400 text-sm font-medium uppercase tracking-wider mb-3">Overdue</p>
              {isLoading ? (
                <div className="animate-pulse bg-canvas-dark/20 rounded h-12 w-24" />
              ) : (
                <p className={`text-5xl font-serif tabular-nums ${overdueCount > 0 ? 'text-danger' : 'text-dark-primary'}`}>
                  {error ? unavailable : overdueCount > 0 ? formatCurrency(overdueTotal) : '0'}
                </p>
              )}
              <p className="mt-3 text-grey-400 text-sm">
                {error ? 'Unable to load' : `${overdueCount} invoice${overdueCount !== 1 ? 's' : ''} outstanding`}
              </p>
            </div>
          </div>

          {/* Setup Checklist - First Run Experience */}
          {totalMembers === 0 && !isLoading && !error && (
            <div className="bg-surface rounded-3xl p-8 border border-grey-200 mb-8">
              <h2 className="font-serif text-2xl text-dark-primary mb-4">Get started</h2>
              <p className="text-grey-400 text-sm mb-6">Set up your club in a few minutes</p>
              <div className="space-y-3">
                <Link href="/squads" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-canvas/50 transition-colors group">
                  <div className="bg-brand/10 w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                    <Users className="w-5 h-5 text-brand" />
                  </div>
                  <span className="font-medium text-dark-primary flex-1">Create your first squad</span>
                  <ArrowRight className="w-5 h-5 text-grey-300 group-hover:text-brand transition-colors" />
                </Link>
                <Link href="/members" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-canvas/50 transition-colors group">
                  <div className="bg-brand/10 w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                    <UserPlus className="w-5 h-5 text-brand" />
                  </div>
                  <span className="font-medium text-dark-primary flex-1">Register a {MEMBER_NOUN_LOWER}</span>
                  <ArrowRight className="w-5 h-5 text-grey-300 group-hover:text-brand transition-colors" />
                </Link>
                <Link href="/sessions" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-canvas/50 transition-colors group">
                  <div className="bg-brand/10 w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                    <Calendar className="w-5 h-5 text-brand" />
                  </div>
                  <span className="font-medium text-dark-primary flex-1">Schedule a training session</span>
                  <ArrowRight className="w-5 h-5 text-grey-300 group-hover:text-brand transition-colors" />
                </Link>
                <Link href="/billing" className="flex items-center gap-4 p-4 rounded-2xl hover:bg-canvas/50 transition-colors group">
                  <div className="bg-brand/10 w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0">
                    <Receipt className="w-5 h-5 text-brand" />
                  </div>
                  <span className="font-medium text-dark-primary flex-1">Set up billing</span>
                  <ArrowRight className="w-5 h-5 text-grey-300 group-hover:text-brand transition-colors" />
                </Link>
              </div>
            </div>
          )}

          {/* Two Column: Sessions + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Upcoming Sessions */}
            <div className="bg-dark-primary rounded-3xl p-8">
              <h2 className="font-serif text-3xl text-white mb-6">Upcoming Sessions</h2>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-white/5 rounded-2xl h-16" />
                  ))}
                </div>
              ) : upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((session, idx) => (
                    <div
                      key={session.session_id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
                          <span className="text-white font-serif text-lg">{idx + 1}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{session.session_name}</p>
                          <p className="text-white/70 text-sm">{formatSessionTime(session, formatDate)}</p>
                        </div>
                      </div>
                      <span className="text-xs text-brand/80 bg-brand/10 px-3 py-1 rounded-full">
                        {session.status || 'scheduled'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/30 mb-3">Schedule your first training session to see it here</p>
                  <Link href="/sessions" className="text-brand text-sm font-semibold hover:underline">
                    Schedule a session &rarr;
                  </Link>
                </div>
              )}
              {upcomingSessions.length > 0 && (
                <Link href="/sessions" className="mt-6 inline-block text-white/70 text-sm hover:text-brand transition-colors">
                  All sessions &rarr;
                </Link>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-surface rounded-3xl p-8 border border-grey-200">
              <h2 className="font-serif text-3xl text-dark-primary mb-6">Recent Activity</h2>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-canvas/50 rounded-2xl h-16" />
                  ))}
                </div>
              ) : (() => {
                const activityFeed = buildActivityFeed(members, overdueInvoices, recentSessions, formatCurrency, formatDate).slice(0, 6);
                const iconMap = {
                  user: { bg: 'bg-brand/10', colour: 'text-brand' },
                  receipt: { bg: 'bg-info/10', colour: 'text-info' },
                  users: { bg: 'bg-coral/10', colour: 'text-coral' },
                };
                return activityFeed.length > 0 ? (
                  <div className="divide-y divide-grey-200">
                    {activityFeed.map((activity) => {
                      const style = iconMap[activity.icon];
                      return (
                        <div key={activity.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                          <div className={`w-10 h-10 ${style.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            {activity.icon === 'user' && <UserPlus className={`w-4 h-4 ${style.colour}`} />}
                            {activity.icon === 'receipt' && <Receipt className={`w-4 h-4 ${style.colour}`} />}
                            {activity.icon === 'users' && <Users className={`w-4 h-4 ${style.colour}`} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-dark-primary font-medium text-sm truncate">
                              {activity.title}
                            </p>
                            <p className="text-grey-400 text-xs">{activity.subtitle}</p>
                          </div>
                          <span className="text-grey-300 text-xs flex-shrink-0">{getTimeAgo(activity.timestamp)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-grey-300 text-center py-8">Activity will appear here as {MEMBER_NOUN_PLURAL_LOWER} join and sessions are completed.</p>
                );
              })()}
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Attendance', href: '/attendance', icon: (
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { label: 'Billing', href: '/billing', icon: (
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { label: 'Squads', href: '/squads', icon: (
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              )},
              { label: 'Communications', href: '/communications', icon: (
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )},
              { label: 'Compliance', href: '/compliance', icon: (
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              )},
              { label: MEMBER_NOUN_PLURAL, href: '/members', icon: (
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )},
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-dark-primary/5 hover:bg-dark-primary hover:text-white text-dark-primary rounded-2xl p-6 text-center transition-all group min-h-[44px] flex flex-col items-center gap-3"
              >
                <span className="text-dark-primary/40 group-hover:text-brand transition-colors">{item.icon}</span>
                <p className="font-medium text-sm group-hover:text-brand transition-colors">{item.label}</p>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </MainLayout>
  );
}
