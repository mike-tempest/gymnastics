'use client';

import { governingBodyConfig, defaultGoverningBodyForCountry } from '@club-manager/shared-types';
import { Users, CheckCircle, XCircle, Search, Download } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';

import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { getConsentData, MemberConsent } from '@/lib/api/compliance';
import { MEMBER_NOUN, MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { downloadCsv } from '@/lib/csv-export';

type FilterTab = 'all' | 'complete' | 'incomplete';

function isConsentComplete(member: MemberConsent): boolean {
  return member.medicalConsent && member.photoConsent && member.dataConsent;
}

function ConsentBadge({ granted }: { granted: boolean }) {
  if (granted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/20 text-success border border-success/40">
        <CheckCircle className="w-3 h-3" aria-hidden="true" />
        Yes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger/20 text-danger border border-danger/40">
      <XCircle className="w-3 h-3" aria-hidden="true" />
      No
    </span>
  );
}

export default function ConsentManagementPage() {
  const { formatDate } = useFormatters();
  const { country, club } = useClubRegion();
  // Data-sharing consent names the governing body the data actually goes to.
  const { dataSharingRecipient } = governingBodyConfig(
    club?.governing_body ?? defaultGoverningBodyForCountry(country)
  );
  const [consentData, setConsentData] = useState<MemberConsent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getConsentData();
      setConsentData(result);
    } catch {
      setError('Failed to load consent data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMembers = useMemo(() => {
    let result = consentData;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(query) || s.squad.toLowerCase().includes(query)
      );
    }

    if (activeTab === 'complete') {
      result = result.filter((s) => isConsentComplete(s));
    } else if (activeTab === 'incomplete') {
      result = result.filter((s) => !isConsentComplete(s));
    }

    return result;
  }, [consentData, searchQuery, activeTab]);

  const completeCount = consentData.filter((s) => isConsentComplete(s)).length;
  const incompleteCount = consentData.length - completeCount;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: consentData.length },
    { key: 'complete', label: 'Complete', count: completeCount },
    { key: 'incomplete', label: 'Incomplete', count: incompleteCount },
  ];

  if (isLoading) {
    return (
      <MainLayout>
        <LoadingSpinner message="Loading consent data..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <ErrorState message="Failed to load consent data." onRetry={fetchData} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[{ label: 'Compliance', href: '/compliance' }, { label: 'Consent' }]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-2">
                Consent management
              </h1>
              <p className="text-grey-600 text-lg">
                Track medical, photo, and data consent for all members. Data consent covers data
                sharing with {dataSharingRecipient}.
              </p>
            </div>
            <button
              onClick={() =>
                downloadCsv(
                  'consent-records.csv',
                  filteredMembers.map((s) => ({
                    Name: s.name,
                    Squad: s.squad,
                    'Medical Consent': s.medicalConsent ? 'Yes' : 'No',
                    'Photo Consent': s.photoConsent ? 'Yes' : 'No',
                    'Data Consent': s.dataConsent ? 'Yes' : 'No',
                    'Last Updated': s.lastUpdated,
                  }))
                )
              }
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-dark-primary rounded-card p-5 border border-white/10 shadow-card">
              <div className="flex items-center gap-3">
                <Users className="w-6 h-6 text-brand" />
                <div>
                  <p className="text-white/60 text-sm">Total {MEMBER_NOUN_PLURAL_LOWER}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">{consentData.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-primary rounded-card p-5 border border-white/10 shadow-card">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success" />
                <div>
                  <p className="text-white/60 text-sm">All consents complete</p>
                  <p className="text-2xl font-bold text-success tabular-nums">{completeCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-dark-primary rounded-card p-5 border border-white/10 shadow-card">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-danger" />
                <div>
                  <p className="text-white/60 text-sm">Incomplete</p>
                  <p className="text-2xl font-bold text-danger tabular-nums">{incompleteCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
            {/* Search and Filter Tabs */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search by ${MEMBER_NOUN_LOWER} name or squad...`}
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all"
                />
              </div>
              <div className="flex rounded-xl overflow-hidden border border-white/20">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-3 min-h-[44px] text-sm font-semibold transition-colors ${
                      activeTab === tab.key
                        ? 'bg-brand text-dark-primary'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            {consentData.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No consent records yet"
                description={`Collect medical, photography, and data consent from parents so you have a clear record for every ${MEMBER_NOUN_LOWER}.`}
                actionLabel={null}
              />
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon={Search}
                title={`No ${MEMBER_NOUN_PLURAL_LOWER} found`}
                description={`No ${MEMBER_NOUN_PLURAL_LOWER} match your search criteria.`}
                actionLabel="Clear filters"
                actionOnClick={() => {
                  setSearchQuery('');
                  setActiveTab('all');
                }}
              />
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-semibold">{member.name}</p>
                          <p className="text-white/60 text-sm">{member.squad}</p>
                        </div>
                        <p className="text-white/60 text-xs tabular-nums">
                          {formatDate(member.lastUpdated, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/60 text-xs">Medical</span>
                          <ConsentBadge granted={member.medicalConsent} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/60 text-xs">Photo</span>
                          <ConsentBadge granted={member.photoConsent} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/60 text-xs">Data</span>
                          <ConsentBadge granted={member.dataConsent} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          {MEMBER_NOUN}
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Squad
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Medical consent
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Photo consent
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Data consent
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Last updated
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <p className="text-white font-semibold">{member.name}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-white/80 text-sm">{member.squad}</p>
                          </td>
                          <td className="py-4 px-4">
                            <ConsentBadge granted={member.medicalConsent} />
                          </td>
                          <td className="py-4 px-4">
                            <ConsentBadge granted={member.photoConsent} />
                          </td>
                          <td className="py-4 px-4">
                            <ConsentBadge granted={member.dataConsent} />
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-white/80 text-sm tabular-nums">
                              {formatDate(member.lastUpdated, {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-white/60 text-sm mt-4">
                  Showing {filteredMembers.length} of {consentData.length} records
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
