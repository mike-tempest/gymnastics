'use client';

import {
  governingBodyConfig,
  defaultGoverningBodyForCountry,
  checkNoun,
} from '@club-manager/shared-types';
import { FileText, CheckCircle, Clock, XCircle, Search, Download, Plus } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';

import AddCheckModal from '@/components/compliance/AddCheckModal';
import ComplianceStatusBadge, {
  type ComplianceStatus,
} from '@/components/compliance/ComplianceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { getDbsChecks, DbsCheck } from '@/lib/api/compliance';
import { downloadCsv } from '@/lib/csv-export';

const STATUS_MAP: Record<DbsCheck['status'], { status: ComplianceStatus; label: string }> = {
  valid: { status: 'compliant', label: 'Valid' },
  expiring: { status: 'expiring-soon', label: 'Expiring soon' },
  expired: { status: 'expired', label: 'Expired' },
};

export default function DbsChecksPage() {
  const { formatDate } = useFormatters();
  const { country, club } = useClubRegion();
  // Prefer the club's saved governing body; fall back to the country default.
  const config = governingBodyConfig(
    club?.governing_body ?? defaultGoverningBodyForCountry(country)
  );
  const framework = config.backgroundCheckFramework;
  // Copy building blocks: the noun never doubles "Check" ("Working With
  // Children checks"), the short label suits tight surfaces ("WWCC number"),
  // and "disclosure" is DBS vocabulary only.
  const noun = checkNoun(framework);
  const shortLabel = config.backgroundCheckShortLabel;
  const usesDbsVocabulary = framework === 'DBS';
  const csvFileName = `${shortLabel.toLowerCase().replace(/\s+/g, '-')}-checks.csv`;
  const [showAddModal, setShowAddModal] = useState(false);
  const [dbsChecks, setDbsChecks] = useState<DbsCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDbsChecks();
      setDbsChecks(result);
    } catch {
      setError(`Failed to load ${noun} check data.`);
    } finally {
      setIsLoading(false);
    }
  }, [noun]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredChecks = useMemo(() => {
    let result = dbsChecks;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.role.toLowerCase().includes(query) ||
          c.dbsNumber.toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }

    return result;
  }, [dbsChecks, searchQuery, statusFilter]);

  const validCount = dbsChecks.filter((c) => c.status === 'valid').length;
  const expiringCount = dbsChecks.filter((c) => c.status === 'expiring').length;
  const expiredCount = dbsChecks.filter((c) => c.status === 'expired').length;

  if (isLoading) {
    return (
      <MainLayout>
        <LoadingSpinner message={`Loading ${noun} check data...`} />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <ErrorState message={`Failed to load ${noun} check data.`} onRetry={fetchData} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[{ label: 'Compliance', href: '/compliance' }, { label: `${noun} checks` }]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-2">
                {noun} check tracker
              </h1>
              <p className="text-grey-600 text-lg">
                Monitor {noun} {usesDbsVocabulary ? 'disclosure' : 'check'} status for all staff and
                volunteers
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold bg-transparent border border-grey-300 text-dark-primary hover:border-brand transition-all"
              >
                <Plus className="w-5 h-5" />
                Add check
              </button>
              <button
                onClick={() =>
                  downloadCsv(
                    csvFileName,
                    filteredChecks.map((c) => ({
                      Name: c.name,
                      Role: c.role,
                      [`${shortLabel} Number`]: c.dbsNumber,
                      'Check Date': c.checkDate,
                      'Expiry Date': c.expiryDate,
                      Status: c.status,
                    }))
                  )
                }
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm"
              >
                <Download className="w-5 h-5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-dark-primary rounded-card p-5 border border-white/10 shadow-card">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success" />
                <div>
                  <p className="text-white/60 text-sm">Valid</p>
                  <p className="text-2xl font-bold text-success tabular-nums">{validCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-primary rounded-card p-5 border border-white/10 shadow-card">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-warning" />
                <div>
                  <p className="text-white/60 text-sm">Expiring within 90 days</p>
                  <p className="text-2xl font-bold text-warning tabular-nums">{expiringCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-primary rounded-card p-5 border border-white/10 shadow-card">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-danger" />
                <div>
                  <p className="text-white/60 text-sm">Expired</p>
                  <p className="text-2xl font-bold text-danger tabular-nums">{expiredCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search by name, role, or ${shortLabel} number...`}
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all w-full sm:min-w-[200px]"
              >
                <option value="">All statuses</option>
                <option value="valid">Valid</option>
                <option value="expiring">Expiring soon</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            {dbsChecks.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={`No ${noun} checks yet`}
                description={`Record ${noun} ${usesDbsVocabulary ? 'disclosures' : 'checks'} for your coaches and volunteers so you can track expiry dates and stay ${config.safeguardingFramework} compliant.`}
                actionLabel="Add check"
                actionOnClick={() => setShowAddModal(true)}
              />
            ) : filteredChecks.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No ${noun} checks found`}
                description={`No ${noun} checks match your search criteria.`}
                actionLabel="Clear filters"
                actionOnClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                }}
              />
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {filteredChecks.map((check) => {
                    const badge = STATUS_MAP[check.status];
                    return (
                      <div
                        key={check.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-white font-semibold">{check.name}</p>
                            <p className="text-white/60 text-sm">{check.role}</p>
                          </div>
                          <ComplianceStatusBadge status={badge.status} label={badge.label} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-white/60 text-xs">{shortLabel} number</p>
                            <p className="text-white/80 font-mono tabular-nums">
                              {check.dbsNumber}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 text-xs">Check date</p>
                            <p className="text-white/80 tabular-nums">
                              {formatDate(check.checkDate, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-white/60 text-xs">Expiry date</p>
                            <p className="text-white/80 tabular-nums">
                              {formatDate(check.expiryDate, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          {shortLabel} number
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Check date
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Expiry date
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredChecks.map((check) => {
                        const badge = STATUS_MAP[check.status];
                        return (
                          <tr
                            key={check.id}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <p className="text-white font-semibold">{check.name}</p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-white/80 text-sm">{check.role}</p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-white/60 text-sm font-mono tabular-nums">
                                {check.dbsNumber}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-white/80 text-sm tabular-nums">
                                {formatDate(check.checkDate, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-white/80 text-sm tabular-nums">
                                {formatDate(check.expiryDate, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <ComplianceStatusBadge status={badge.status} label={badge.label} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="text-white/60 text-sm mt-4">
                  Showing {filteredChecks.length} of {dbsChecks.length} records
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      {showAddModal && (
        <AddCheckModal
          config={config}
          region={club?.governing_body_region}
          onClose={() => setShowAddModal(false)}
          onCreated={fetchData}
        />
      )}
    </MainLayout>
  );
}
