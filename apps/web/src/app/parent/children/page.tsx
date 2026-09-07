'use client';

import { Member , AttendanceStats, Session } from '@club-manager/shared-types';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';

import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  fetchParentMembers,
  fetchMemberAttendanceStats,
  fetchMemberSchedule,
} from '@/lib/api/parent';
import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

interface MemberWithStats extends Member {
  squad?: { squad_id: string; squad_name: string };
  attendanceStats?: AttendanceStats;
  upcomingSessionsCount: number;
}

function attendanceColour(rate: number): string {
  if (rate >= 80) return 'text-success';
  if (rate >= 60) return 'text-warning';
  return 'text-danger';
}

export default function ChildrenListPage() {
  const [members, setMembers] = useState<MemberWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadChildren() {
      try {
        setIsLoading(true);
        setError(null);

        const memberData = await fetchParentMembers();

        const enriched = await Promise.all(
          memberData.map(async (member) => {
            const [stats, schedule] = await Promise.all([
              fetchMemberAttendanceStats(member.member_id).catch(() => undefined),
              fetchMemberSchedule(member.member_id).catch(() => [] as Session[]),
            ]);

            return {
              ...member,
              attendanceStats: stats,
              upcomingSessionsCount: schedule.length,
            } as MemberWithStats;
          })
        );

        setMembers(enriched);
      } catch (err) {
        setError('Failed to load your children. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    loadChildren();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-6 sm:p-10 flex items-center justify-center">
        <LoadingSpinner message="Loading your children..." />
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

  return (
    <div className="min-h-dvh bg-canvas p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumb items={[{ label: 'Parent Portal', href: '/parent' }, { label: 'Children' }]} />
          <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">Your children</h1>
          <p className="text-text-secondary text-lg">
            View and manage your registered members.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Total children</p>
            <p className="text-4xl font-bold text-brand tabular-nums">{members.length}</p>
          </div>

          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Squads</p>
            <p className="text-4xl font-bold text-brand tabular-nums">
              {new Set(members.map((s) => s.squad_id).filter(Boolean)).size}
            </p>
          </div>

          <div className="bg-dark-primary rounded-card p-6 md:p-8 shadow-card border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-success/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-success" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-text-secondary text-sm mb-2">Average attendance</p>
            <p className="text-4xl font-bold text-success tabular-nums">
              {members.length > 0
                ? `${Math.round(
                    members.reduce((sum, s) => sum + (s.attendanceStats?.attendance_rate ?? 0), 0) /
                      members.length
                  )}%`
                : 'N/A'}
            </p>
          </div>
        </div>

        {/* Children List */}
        <div className="bg-dark-primary rounded-card shadow-card border border-white/10">
          <div className="p-4 md:p-6 border-b border-white/10">
            <h2 className="font-serif text-2xl text-white">Registered {MEMBER_NOUN_PLURAL_LOWER}</h2>
          </div>
          <div className="p-4 md:p-6">
            {members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No children registered"
                description="Contact your club to register your children and get started."
              />
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <Link
                    key={member.member_id}
                    href={`/parent/children/${member.member_id}`}
                    className="flex items-center justify-between p-5 min-h-[44px] bg-white/5 rounded-2xl hover:bg-white/10 active:bg-white/5 active:scale-[0.98] transition-all group"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="w-14 h-14 bg-brand/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-brand font-bold text-xl">
                          {member.first_name[0]}{member.last_name[0]}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-lg group-hover:text-brand transition-colors">
                          {member.first_name} {member.last_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {member.squad?.squad_name && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand/10 text-brand border border-brand/20">
                              {member.squad.squad_name}
                            </span>
                          )}
                          <span className="text-text-tertiary text-sm">
                            {member.registration_number || 'No registration number'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 flex-shrink-0 ml-4">
                      {/* Upcoming Sessions */}
                      <div className="hidden md:block text-right">
                        <p className="text-text-tertiary text-xs">Upcoming</p>
                        <p className="text-brand font-bold text-lg tabular-nums">
                          {member.upcomingSessionsCount}
                        </p>
                      </div>
                      {/* Attendance */}
                      <div className="hidden md:block text-right">
                        <p className="text-text-tertiary text-xs">Attendance</p>
                        <p className={`font-bold text-lg tabular-nums ${attendanceColour(member.attendanceStats?.attendance_rate ?? 0)}`}>
                          {member.attendanceStats
                            ? `${member.attendanceStats.attendance_rate}%`
                            : 'N/A'}
                        </p>
                      </div>
                      {/* Chevron */}
                      <svg className="w-5 h-5 text-text-tertiary group-hover:text-brand transition-colors" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
