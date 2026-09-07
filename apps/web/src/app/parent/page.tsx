'use client';

import { Session, Member } from '@club-manager/shared-types';
import { Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { InvoiceWithDetails } from '@/lib/api/finance';
import {
  fetchParentDashboard,
  fetchParentMembers,
  fetchParentInvoices,
  fetchParentUpcomingSessions,
  ParentDashboardSummary,
} from '@/lib/api/parent';

function getCountdown(sessions: Session[]): { label: string; detail: string } | null {
  if (!sessions.length) return null;

  const now = new Date();
  const nextSession = sessions[0];
  const sessionDate = new Date(`${nextSession.session_date}T${nextSession.start_time}`);
  const diffMs = sessionDate.getTime() - now.getTime();

  if (diffMs <= 0) return { label: 'Now', detail: nextSession.session_name };

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;

  if (diffDays > 0) {
    return {
      label: `${diffDays}d ${remainingHours}h`,
      detail: nextSession.session_name,
    };
  }

  const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);
  return {
    label: `${diffHours}h ${diffMinutes}m`,
    detail: nextSession.session_name,
  };
}

interface ActivityItem {
  id: string;
  type: 'payment' | 'session' | 'registration';
  title: string;
  description: string;
  date: string;
}

function generateRecentActivity(
  invoices: InvoiceWithDetails[],
  sessions: Session[],
  formatCurrency: (amount: number | string, currencyOverride?: string) => string
): ActivityItem[] {
  const activities: ActivityItem[] = [];

  invoices.forEach((inv) => {
    if (inv.status === 'paid') {
      activities.push({
        id: `pay-${inv.invoice_id}`,
        type: 'payment',
        title: 'Payment received',
        description: `${inv.invoice_number} for ${formatCurrency(inv.total_amount, inv.currency)}`,
        date: String(inv.updated_at),
      });
    }
  });

  sessions.slice(0, 3).forEach((sess) => {
    activities.push({
      id: `sess-${sess.session_id}`,
      type: 'session',
      title: 'Upcoming session',
      description: `${sess.session_name} at ${sess.location || 'TBC'}`,
      date: sess.session_date,
    });
  });

  return activities
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

export default function ParentDashboardPage() {
  const { formatCurrency, formatDate } = useFormatters();
  const [dashboard, setDashboard] = useState<ParentDashboardSummary | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithDetails[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);
        const [dashData, membersData, invData, sessData] = await Promise.all([
          fetchParentDashboard(),
          fetchParentMembers(),
          fetchParentInvoices(),
          fetchParentUpcomingSessions(),
        ]);
        setDashboard(dashData);
        setMembers(membersData);
        setInvoices(invData);
        setSessions(sessData);
      } catch (err) {
        setError('Failed to load dashboard. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-6 sm:p-10 flex items-center justify-center">
        <LoadingSpinner message="Loading your dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  const outstandingInvoices = invoices.filter(
    (inv) => inv.status === 'pending' || inv.status === 'overdue'
  );
  const totalOutstanding = outstandingInvoices.reduce(
    (sum, inv) => sum + Number(inv.total_amount),
    0
  );
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');
  const countdown = getCountdown(sessions);
  const recentActivity = generateRecentActivity(invoices, sessions, formatCurrency);

  return (
    <div className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">Parent Portal</h1>
          <p className="text-text-secondary text-lg">
            Welcome back. Here is your family overview.
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Children Count */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Children registered</p>
            <p className="text-4xl font-bold text-brand tabular-nums">{dashboard?.childrenCount ?? members.length}</p>
          </div>

          {/* Upcoming Sessions */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Upcoming sessions</p>
            <p className="text-4xl font-bold text-brand tabular-nums">{sessions.length}</p>
          </div>

          {/* Outstanding Invoices */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-warning/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-warning" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Outstanding</p>
            <p className="text-4xl font-bold text-warning tabular-nums">{formatCurrency(totalOutstanding)}</p>
          </div>

          {/* Next Session Countdown */}
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Next session</p>
            {countdown ? (
              <>
                <p className="text-4xl font-bold text-brand tabular-nums">{countdown.label}</p>
                <p className="text-text-tertiary text-xs mt-1 truncate">{countdown.detail}</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-text-tertiary">No sessions</p>
            )}
          </div>
        </div>

        {/* Two-column layout: Quick Links + Payment Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Quick Links to Children */}
          <div className="bg-dark-primary rounded-card shadow-card border border-white/10">
            <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-white">Your children</h2>
              <Link
                href="/parent/children"
                className="text-brand hover:text-brand-light transition-colors text-sm font-semibold min-h-[44px] inline-flex items-center"
              >
                View all
              </Link>
            </div>
            <div className="p-4 md:p-6">
              {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="w-12 h-12 text-text-tertiary mb-4" />
                  <p className="text-white font-semibold mb-1">No children registered</p>
                  <p className="text-text-secondary text-sm">Contact your club to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <Link
                      key={member.member_id}
                      href={`/parent/children/${member.member_id}`}
                      className="flex items-center justify-between p-4 min-h-[44px] bg-white/5 rounded-2xl hover:bg-white/10 active:bg-white/5 active:scale-[0.98] transition-all group"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-brand/20 rounded-full flex items-center justify-center">
                          <span className="text-brand font-bold text-lg">
                            {member.first_name[0]}{member.last_name[0]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold group-hover:text-brand transition-colors truncate">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-text-tertiary text-sm truncate">
                            {member.registration_number || 'No registration number'}
                          </p>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-text-tertiary group-hover:text-brand transition-colors" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payment Status Summary */}
          <div className="bg-dark-primary rounded-card shadow-card border border-white/10">
            <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-serif text-2xl text-white">Payment summary</h2>
              <Link
                href="/parent/invoices"
                className="text-brand hover:text-brand-light transition-colors text-sm font-semibold min-h-[44px] inline-flex items-center"
              >
                View invoices
              </Link>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-white font-medium">Pending</span>
                </div>
                <div className="text-right">
                  <span className="text-warning font-bold tabular-nums">
                    {invoices.filter((i) => i.status === 'pending').length}
                  </span>
                  <span className="text-text-tertiary ml-2 tabular-nums">
                    {formatCurrency(
                      invoices
                        .filter((i) => i.status === 'pending')
                        .reduce((s, i) => s + Number(i.total_amount), 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-danger" />
                  <span className="text-white font-medium">Overdue</span>
                </div>
                <div className="text-right">
                  <span className="text-danger font-bold tabular-nums">
                    {invoices.filter((i) => i.status === 'overdue').length}
                  </span>
                  <span className="text-text-tertiary ml-2 tabular-nums">
                    {formatCurrency(
                      invoices
                        .filter((i) => i.status === 'overdue')
                        .reduce((s, i) => s + Number(i.total_amount), 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-white font-medium">Paid</span>
                </div>
                <div className="text-right">
                  <span className="text-success font-bold tabular-nums">{paidInvoices.length}</span>
                  <span className="text-text-tertiary ml-2 tabular-nums">
                    {formatCurrency(
                      paidInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
                    )}
                  </span>
                </div>
              </div>

              {totalOutstanding > 0 && (
                <div className="mt-4 p-4 bg-warning/10 border border-warning/30 rounded-xl">
                  <p className="text-warning font-semibold text-sm tabular-nums">
                    Total outstanding: {formatCurrency(totalOutstanding)}
                  </p>
                  <Link
                    href="/parent/invoices"
                    className="text-warning/90 hover:text-warning text-xs mt-1 min-h-[44px] inline-flex items-center underline"
                  >
                    View outstanding invoices
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity Timeline */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Recent activity</h2>
          </div>
          <div className="p-4 md:p-6">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="w-12 h-12 text-text-tertiary mb-4" />
                <p className="text-white font-semibold mb-1">No recent activity</p>
                <p className="text-text-secondary text-sm">Activity will appear here as sessions and payments are recorded.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start space-x-4 p-4 bg-white/5 rounded-2xl"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'payment'
                          ? 'bg-success/20'
                          : 'bg-brand/20'
                      }`}
                    >
                      {activity.type === 'payment' && (
                        <svg className="w-5 h-5 text-success" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {activity.type === 'session' && (
                        <svg className="w-5 h-5 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                      {activity.type === 'registration' && (
                        <svg className="w-5 h-5 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{activity.title}</p>
                      <p className="text-text-tertiary text-sm truncate">{activity.description}</p>
                    </div>
                    <span className="text-text-tertiary text-xs flex-shrink-0 tabular-nums">
                      {formatDate(activity.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
