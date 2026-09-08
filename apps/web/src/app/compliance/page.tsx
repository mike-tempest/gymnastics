'use client';

import { governingBodyConfig, defaultGoverningBodyForCountry, checkNoun } from '@club-manager/shared-types';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Users,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

import ComplianceStatusBadge, {
  type ComplianceStatus,
} from '@/components/compliance/ComplianceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import {
  getComplianceSummary,
  ComplianceSummary,
  SafeguardingOfficerSummary,
} from '@/lib/api/compliance';
import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

function getHealthScoreInfo(score: number) {
  if (score >= 80) return { ring: 'text-success', text: 'text-success', label: 'Good' };
  if (score >= 60) return { ring: 'text-warning', text: 'text-warning', label: 'Needs attention' };
  return { ring: 'text-danger', text: 'text-danger', label: 'Action required' };
}

/**
 * How long a check has left, or how long ago it lapsed. A negative count is a
 * check that expired while nobody was looking, which the expiry query returns
 * alongside the ones still running down.
 */
function expiryCountdown(days: number): string {
  if (days === 0) return 'Expires today';
  if (days < 0) {
    const elapsed = Math.abs(days);
    return `Expired ${elapsed} ${elapsed === 1 ? 'day' : 'days'} ago`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'} remaining`;
}

/**
 * The badge for an officer's own background check. The officer sits in their
 * own record rather than the check register, so this is the only place their
 * expiry is shown; it reports what the date actually says.
 */
function officerCheckBadge(officer: SafeguardingOfficerSummary): {
  status: ComplianceStatus;
  label: string;
} {
  const days = officer.daysRemaining;

  switch (officer.checkStatus) {
    case 'valid':
      return { status: 'compliant', label: 'Valid' };
    case 'expiring':
      return { status: 'expiring-soon', label: expiryCountdown(days ?? 0) };
    case 'expired':
      return { status: 'expired', label: 'Expired' };
    default:
      return { status: 'not-required', label: 'No expiry recorded' };
  }
}

function officerInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('');
}

export default function ComplianceDashboardPage() {
  const { formatDate } = useFormatters();
  const { country, club } = useClubRegion();
  // Prefer the club's saved governing body; fall back to the country default
  // (Swim England for GB and unknowns, matching the previous behaviour).
  const config = governingBodyConfig(club?.governing_body ?? defaultGoverningBodyForCountry(country));
  const framework = config.backgroundCheckFramework;
  // "DBS" stays "DBS"; "Working With Children Check" loses its trailing
  // "Check" so "checks"/"check tracker" copy never doubles the word.
  const noun = checkNoun(framework);
  const shortLabel = config.backgroundCheckShortLabel;
  const officerLabel = config.safeguardingOfficerLabel;
  const [data, setData] = useState<ComplianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getComplianceSummary();
      setData(result);
    } catch {
      setError('Failed to load compliance data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <MainLayout>
        <LoadingSpinner message="Loading compliance data..." />
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <ErrorState message="Failed to load compliance data." onRetry={fetchData} />
      </MainLayout>
    );
  }

  const scoreInfo = getHealthScoreInfo(data.healthScore);
  // Fall back to the single-officer field so the page still renders against an
  // API that has not been redeployed yet.
  const officers =
    data.safeguardingOfficers ?? (data.safeguardingOfficer ? [data.safeguardingOfficer] : []);
  const officersNeedingAttention = officers.filter(
    (officer) => officer.checkStatus === 'expiring' || officer.checkStatus === 'expired',
  );

  // The onboarding empty state is for a club that has recorded nothing yet, so
  // it keys on the record counts rather than on the consent figures, which now
  // count members: any club with members reports some as missing, which is the
  // point of the screen and not a reason to hide it.
  const hasNoRecords = data.dbsChecks === 0 && data.consentRecords === 0;

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-2">
                Compliance and {config.safeguardingFramework}
              </h1>
              <p className="text-grey-600 text-lg">
                {noun} checks, consent management, and safeguarding overview
              </p>
            </div>
          </div>

          {hasNoRecords ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/10">
              <EmptyState
                icon={ShieldCheck}
                title="Safeguarding starts here"
                description={`Compliance tracking helps you stay on top of ${noun} checks, parental consent, and ${config.label} ${config.safeguardingFramework} requirements. Your club's compliance health score updates automatically as you add records.`}
                hint={`This is not about paperwork for its own sake. It is about keeping ${MEMBER_NOUN_PLURAL_LOWER} safe and giving parents peace of mind.`}
                features={[
                  `Track ${noun} check expiry dates for all coaches and volunteers`,
                  'Collect and manage photography and medical consent from parents',
                  'Get alerts before certificates expire',
                  `Designate your ${officerLabel} for ${config.safeguardingFramework} compliance`,
                ]}
                actionLabel={`Add ${noun} checks`}
                actionHref="/compliance/dbs"
              />
            </div>
          ) : (
            <>
              {/* Health Score Card */}
              <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/10 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <p className="text-white/60 text-lg font-semibold mb-3">Club compliance health</p>
                    <div className="flex items-end gap-4 mb-4">
                      <h2 className="text-5xl sm:text-7xl font-bold text-white tabular-nums">{data.healthScore}</h2>
                      <span className="text-2xl sm:text-3xl text-white/40 mb-2 tabular-nums">/ 100</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold border bg-white/5 ${scoreInfo.text} border-white/10`}
                    >
                      {scoreInfo.label}
                    </span>
                  </div>

                  {/* Score ring visualisation */}
                  <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto sm:mx-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="currentColor"
                        className="text-white/10"
                        strokeWidth="10"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="currentColor"
                        className={scoreInfo.ring}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(data.healthScore / 100) * 314} 314`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-serif text-3xl text-white tabular-nums">{data.healthScore}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* DBS Summary */}
                <Link
                  href="/compliance/dbs"
                  className="bg-dark-primary rounded-card p-6 border border-white/10 hover:border-brand shadow-card hover:shadow-card-hover transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-brand" />
                      <h3 className="font-serif text-2xl text-white">{noun} checks</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-brand transition-colors" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/60">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Valid
                      </span>
                      <span className="text-sm font-bold text-success tabular-nums">{data.dbsValid}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/60">
                        <Clock className="w-4 h-4 text-warning" />
                        Expiring soon
                      </span>
                      <span className="text-sm font-bold text-warning tabular-nums">{data.dbsExpiringSoon}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/60">
                        <XCircle className="w-4 h-4 text-danger" />
                        Expired
                      </span>
                      <span className="text-sm font-bold text-danger tabular-nums">{data.dbsExpired}</span>
                    </div>
                  </div>
                </Link>

                {/* Consent Summary */}
                <Link
                  href="/compliance/consent"
                  className="bg-dark-primary rounded-card p-6 border border-white/10 hover:border-brand shadow-card hover:shadow-card-hover transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Users className="w-6 h-6 text-brand" />
                      <h3 className="font-serif text-2xl text-white">Consent status</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-brand transition-colors" />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/60">
                        <CheckCircle className="w-4 h-4 text-success" />
                        Complete
                      </span>
                      <span className="text-sm font-bold text-success tabular-nums">{data.consentComplete}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/60">
                        <Clock className="w-4 h-4 text-warning" />
                        Partial
                      </span>
                      <span className="text-sm font-bold text-warning tabular-nums">{data.consentPartial}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm text-white/60">
                        <XCircle className="w-4 h-4 text-danger" />
                        Missing
                      </span>
                      <span className="text-sm font-bold text-danger tabular-nums">{data.consentMissing}</span>
                    </div>
                  </div>
                </Link>

                {/* Safeguarding Summary */}
                <Link
                  href="/compliance/safeguarding"
                  className="bg-dark-primary rounded-card p-6 border border-white/10 hover:border-brand shadow-card hover:shadow-card-hover transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-6 h-6 text-brand" />
                      <h3 className="font-serif text-2xl text-white">Safeguarding</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-brand transition-colors" />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-white/60 mb-1">
                        {officers.length > 1 ? `${officerLabel}s` : officerLabel}
                      </p>
                      <p className="text-sm font-bold text-white">
                        {officers.length === 0
                          ? 'Not assigned'
                          : officers.map((officer) => officer.name).join(', ')}
                      </p>
                    </div>
                    {officers.length > 0 && (
                      <div>
                        <p className="text-sm text-white/60 mb-1">{shortLabel} status</p>
                        {officersNeedingAttention.length > 0 ? (
                          <ComplianceStatusBadge
                            {...officerCheckBadge(officersNeedingAttention[0])}
                          />
                        ) : (
                          <ComplianceStatusBadge {...officerCheckBadge(officers[0])} />
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              </div>

              {/* DBS Expiring Soon */}
              <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10 mb-8">
                <div className="flex items-center gap-3 mb-6">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                  <h2 className="font-serif text-2xl sm:text-3xl text-white">{noun} checks expiring soon</h2>
                </div>

                {data.expiringDbsChecks.length === 0 ? (
                  <p className="text-white/60 text-center py-8">No {noun} checks expiring in the next 90 days.</p>
                ) : (
                  <div className="space-y-3">
                    {data.expiringDbsChecks.map((check) => (
                      <div
                        key={`${check.name}-${check.expiryDate}`}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              check.daysRemaining < 0 ? 'bg-danger/20' : 'bg-warning/20'
                            }`}
                          >
                            {check.daysRemaining < 0 ? (
                              <XCircle className="w-5 h-5 text-danger" />
                            ) : (
                              <Clock className="w-5 h-5 text-warning" />
                            )}
                          </div>
                          <div>
                            <p className="text-white font-semibold">{check.name}</p>
                            <p className="text-white/60 text-sm">{check.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold text-sm tabular-nums ${
                              check.daysRemaining < 0 ? 'text-danger' : 'text-warning'
                            }`}
                          >
                            {expiryCountdown(check.daysRemaining)}
                          </p>
                          <p className="text-white/40 text-xs tabular-nums">
                            Expires {formatDate(check.expiryDate, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Safeguarding Officer Info */}
              <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-6 h-6 text-brand" />
                  <h2 className="font-serif text-2xl sm:text-3xl text-white">
                    {officers.length > 1 ? `${officerLabel}s` : officerLabel}
                  </h2>
                </div>

                {officers.length > 0 ? (
                  <div className="space-y-4">
                    {officers.map((officer) => {
                      const badge = officerCheckBadge(officer);
                      return (
                        <article
                          key={officer.id}
                          aria-label={officer.name}
                          className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                          <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xl bg-brand text-dark-primary shadow-sm">
                            {officerInitials(officer.name)}
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-white/60 text-sm">Name</p>
                              <p className="text-white font-semibold">{officer.name}</p>
                            </div>
                            <div>
                              <p className="text-white/60 text-sm">Role</p>
                              <p className="text-white font-semibold">{officer.role}</p>
                            </div>
                            <div>
                              <p className="text-white/60 text-sm">Email</p>
                              <p className="text-white font-semibold">{officer.email}</p>
                            </div>
                            <div>
                              <p className="text-white/60 text-sm">Phone</p>
                              <p className="text-white font-semibold tabular-nums">
                                {officer.phone || 'Not recorded'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/60 text-sm">{shortLabel} number</p>
                              <p className="text-white font-semibold tabular-nums">
                                {officer.dbsNumber || 'Not recorded'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/60 text-sm">{shortLabel} expiry</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-white font-semibold tabular-nums">
                                  {officer.dbsExpiry
                                    ? formatDate(officer.dbsExpiry, {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })
                                    : 'Not recorded'}
                                </p>
                                <ComplianceStatusBadge status={badge.status} label={badge.label} />
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-white/60 text-center py-8">
                    No {officerLabel.toLowerCase()} assigned.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
