'use client';

import {
  CREDENTIAL_STATUS_LABELS,
  CREDENTIAL_TYPE_LABELS,
  CredentialStatus,
  CredentialType,
} from '@club-manager/shared-types';
import { Award, CheckCircle, Clock, Download, Plus, Search, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import ComplianceStatusBadge, {
  type ComplianceStatus,
} from '@/components/compliance/ComplianceStatusBadge';
import CredentialModal from '@/components/compliance/CredentialModal';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { getCredentials, type CredentialRecord } from '@/lib/api/compliance';
import { MEMBER_NOUN_LOWER } from '@/lib/brand';
import { downloadCsv } from '@/lib/csv-export';

const STATUS_MAP: Record<CredentialStatus, ComplianceStatus> = {
  [CredentialStatus.VALID]: 'compliant',
  [CredentialStatus.EXPIRING_SOON]: 'expiring-soon',
  [CredentialStatus.EXPIRED]: 'expired',
};

const DATE_FORMAT = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;

/** Who holds a credential: a staff user, or a gymnast. */
function holderName(credential: CredentialRecord): string {
  if (credential.user) return `${credential.user.first_name} ${credential.user.last_name}`;
  if (credential.member) return `${credential.member.first_name} ${credential.member.last_name}`;
  return 'Not recorded';
}

function holderKind(credential: CredentialRecord): string {
  return credential.member_id ? MEMBER_NOUN_LOWER : 'staff';
}

export default function CredentialsPage() {
  const { formatDate } = useFormatters();
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialRecord | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCredentials(await getCredentials());
    } catch {
      setError('Failed to load credential records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let result = credentials;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (credential) =>
          holderName(credential).toLowerCase().includes(query) ||
          credential.title.toLowerCase().includes(query) ||
          (credential.issuing_body ?? '').toLowerCase().includes(query) ||
          (credential.reference_number ?? '').toLowerCase().includes(query)
      );
    }

    if (statusFilter) {
      result = result.filter((credential) => credential.status === statusFilter);
    }

    if (typeFilter) {
      result = result.filter((credential) => credential.credential_type === typeFilter);
    }

    return result;
  }, [credentials, searchQuery, statusFilter, typeFilter]);

  const validCount = credentials.filter((c) => c.status === CredentialStatus.VALID).length;
  const expiringCount = credentials.filter(
    (c) => c.status === CredentialStatus.EXPIRING_SOON
  ).length;
  const expiredCount = credentials.filter((c) => c.status === CredentialStatus.EXPIRED).length;

  const openAdd = () => {
    setEditing(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (credential: CredentialRecord) => {
    setEditing(credential);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <LoadingSpinner message="Loading credential records..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <ErrorState message="Failed to load credential records." onRetry={fetchData} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[{ label: 'Compliance', href: '/compliance' }, { label: 'Credentials' }]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-2">
                Credential tracker
              </h1>
              <p className="text-grey-600 text-lg">
                First aid, coaching qualifications and safeguarding training, with expiry warnings
                sent 90, 60, 30, 14 and 7 days before a credential lapses
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={openAdd}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-button font-semibold bg-transparent border border-grey-300 text-dark-primary hover:border-brand transition-all"
              >
                <Plus className="w-5 h-5" />
                Add credential
              </button>
              <button
                onClick={() =>
                  downloadCsv(
                    'credentials.csv',
                    filtered.map((credential) => ({
                      Name: holderName(credential),
                      'Held by': holderKind(credential),
                      Type: CREDENTIAL_TYPE_LABELS[credential.credential_type],
                      Credential: credential.title,
                      'Issued by': credential.issuing_body ?? '',
                      Reference: credential.reference_number ?? '',
                      'Issue date': credential.issue_date,
                      'Expiry date': credential.expiry_date ?? 'Does not expire',
                      Status: CREDENTIAL_STATUS_LABELS[credential.status],
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
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, credential or reference..."
                  className="w-full pl-12 pr-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by credential type"
                className="px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all w-full sm:min-w-[200px]"
              >
                <option value="">All types</option>
                {Object.values(CredentialType).map((type) => (
                  <option key={type} value={type}>
                    {CREDENTIAL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all w-full sm:min-w-[180px]"
              >
                <option value="">All statuses</option>
                {Object.values(CredentialStatus).map((status) => (
                  <option key={status} value={status}>
                    {CREDENTIAL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>

            {credentials.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No credentials yet"
                description="Record first aid certificates, coaching qualifications and safeguarding training so the club is warned before any of them lapse."
                actionLabel="Add credential"
                actionOnClick={openAdd}
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No credentials found"
                description="No credentials match your search criteria."
                actionLabel="Clear filters"
                actionOnClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setTypeFilter('');
                }}
              />
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {filtered.map((credential) => (
                    <button
                      key={credential.credential_id}
                      onClick={() => openEdit(credential)}
                      className="w-full text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-brand transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-white font-semibold">{holderName(credential)}</p>
                          <p className="text-white/60 text-sm">{credential.title}</p>
                        </div>
                        <ComplianceStatusBadge
                          status={STATUS_MAP[credential.status]}
                          label={CREDENTIAL_STATUS_LABELS[credential.status]}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-white/60 text-xs">Type</p>
                          <p className="text-white/80">
                            {CREDENTIAL_TYPE_LABELS[credential.credential_type]}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/60 text-xs">Expiry date</p>
                          <p className="text-white/80 tabular-nums">
                            {credential.expiry_date
                              ? formatDate(credential.expiry_date, DATE_FORMAT)
                              : 'Does not expire'}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
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
                          Type
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Credential
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Issued by
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Expiry date
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((credential) => (
                        <tr
                          key={credential.credential_id}
                          className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <p className="text-white font-semibold">{holderName(credential)}</p>
                            <p className="text-white/50 text-xs">{holderKind(credential)}</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-white/80 text-sm">
                              {CREDENTIAL_TYPE_LABELS[credential.credential_type]}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-white/80 text-sm">{credential.title}</p>
                            {credential.reference_number && (
                              <p className="text-white/50 text-xs font-mono tabular-nums">
                                {credential.reference_number}
                              </p>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-white/60 text-sm">
                              {credential.issuing_body ?? '-'}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-white/80 text-sm tabular-nums">
                              {credential.expiry_date
                                ? formatDate(credential.expiry_date, DATE_FORMAT)
                                : 'Does not expire'}
                            </p>
                          </td>
                          <td className="py-4 px-4">
                            <ComplianceStatusBadge
                              status={STATUS_MAP[credential.status]}
                              label={CREDENTIAL_STATUS_LABELS[credential.status]}
                            />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => openEdit(credential)}
                              className="px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-white/60 text-sm mt-4">
                  Showing {filtered.length} of {credentials.length} records
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      {isModalOpen && (
        <CredentialModal
          credential={editing}
          onClose={() => setIsModalOpen(false)}
          onSaved={fetchData}
        />
      )}
    </MainLayout>
  );
}
