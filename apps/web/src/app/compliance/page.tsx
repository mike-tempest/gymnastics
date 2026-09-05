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

import ComplianceStatusBadge from '@/components/compliance/ComplianceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { getComplianceSummary, ComplianceSummary } from '@/lib/api/compliance';

function getHealthScoreInfo(score: number) {
  if (score >= 80) return { ring: 'text-success', text: 'text-success', label: 'Good' };
  if (score >= 60) return { ring: 'text-warning', text: 'text-warning', label: 'Needs attention' };
  return { ring: 'text-danger', text: 'text-danger', label: 'Action required' };
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

  const hasNoRecords =
    data.healthScore === 0 &&
    data.dbsValid === 0 &&
    data.dbsExpiringSoon === 0 &&
    data.dbsExpired === 0 &&
    data.consentComplete === 0 &&
    data.consentPartial === 0 &&
    data.consentMissing === 0;

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
                hint="This is not about paperwork for its own sake. It is about keeping members safe and giving parents peace of mind."
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
                      <p className="text-sm text-white/60 mb-1">{officerLabel}</p>
                      <p className="text-sm font-bold text-white">{data.safeguardingOfficer?.name ?? 'Not assigned'}</p>
                    </div>
                    {data.safeguardingOfficer && (
                      <div>
                        <p className="text-sm text-white/60 mb-1">{shortLabel} status</p>
                        <ComplianceStatusBadge status="compliant" label="Valid" />
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
                        key={check.name}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-warning/20 rounded-full flex items-center justify-center">
                            <Clock className="w-5 h-5 text-warning" />
                          </div>
                          <div>
                            <p className="text-white font-semibold">{check.name}</p>
                            <p className="text-white/60 text-sm">{check.role}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-warning font-semibold text-sm tabular-nums">
                            {check.daysRemaining} days remaining
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
                  <h2 className="font-serif text-2xl sm:text-3xl text-white">{officerLabel}</h2>
                </div>

                {data.safeguardingOfficer ? (
                  <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xl bg-brand text-dark-primary shadow-sm">
                      {data.safeguardingOfficer.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-white/60 text-sm">Name</p>
                        <p className="text-white font-semibold">{data.safeguardingOfficer.name}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-sm">Role</p>
                        <p className="text-white font-semibold">{data.safeguardingOfficer.role}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-sm">Email</p>
                        <p className="text-white font-semibold">{data.safeguardingOfficer.email}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-sm">Phone</p>
                        <p className="text-white font-semibold tabular-nums">{data.safeguardingOfficer.phone}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-sm">{shortLabel} number</p>
                        <p className="text-white font-semibold tabular-nums">{data.safeguardingOfficer.dbsNumber}</p>
                      </div>
                      <div>
                        <p className="text-white/60 text-sm">{shortLabel} expiry</p>
                        <p className="text-white font-semibold tabular-nums">
                          {formatDate(data.safeguardingOfficer.dbsExpiry, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-white/60 text-center py-8">No welfare officer assigned.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
