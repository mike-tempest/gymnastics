'use client';

import {
  governingBodyConfig,
  defaultGoverningBodyForCountry,
} from '@club-manager/shared-types';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';

import AddOfficerModal from '@/components/compliance/AddOfficerModal';
import ComplianceStatusBadge, { type ComplianceStatus } from '@/components/compliance/ComplianceStatusBadge';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { ApiError } from '@/lib/api/api-client';
import {
  getChecklist,
  getSafeguardingOfficer,
  getIncidents,
  updateChecklistItem,
  ChecklistItem,
  SafeguardingOfficer,
  Incident,
} from '@/lib/api/compliance';

const INCIDENT_STATUS_MAP: Record<Incident['status'], { status: ComplianceStatus; label: string }> = {
  resolved: { status: 'compliant', label: 'Resolved' },
  'under review': { status: 'expiring-soon', label: 'Under review' },
  open: { status: 'expired', label: 'Open' },
};

export default function SafeguardingPage() {
  const { formatDate } = useFormatters();
  const { country, club, isLoading: isRegionLoading } = useClubRegion();
  // Prefer the club's saved governing body; fall back to the country default.
  const config = governingBodyConfig(club?.governing_body ?? defaultGoverningBodyForCountry(country));
  const {
    safeguardingFramework,
    backgroundCheckShortLabel,
    safeguardingOfficerLabel: officerLabel,
  } = config;
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [officer, setOfficer] = useState<SafeguardingOfficer | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidentStatusFilter, setIncidentStatusFilter] = useState<'' | 'open' | 'under review' | 'resolved'>('');
  const [incidentPage, setIncidentPage] = useState(1);
  const INCIDENTS_PER_PAGE = 10;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [checklistData, officerData, incidentsData] = await Promise.all([
        getChecklist(),
        getSafeguardingOfficer(),
        getIncidents(),
      ]);
      setChecklist(checklistData);
      setOfficer(officerData);
      setIncidents(incidentsData);
    } catch {
      setError('Failed to load safeguarding data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleChecklistItem = useCallback(
    async (id: string, completed: boolean) => {
      // Capture the prior state so a failed save reverts to what the server
      // last confirmed, not merely the inverse of this toggle (which would be
      // wrong if another toggle for the same item is already in flight).
      let previousCompleted = completed;
      setChecklist((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          previousCompleted = item.completed;
          return { ...item, completed };
        }),
      );
      try {
        await updateChecklistItem(id, completed);
      } catch (err) {
        // Revert on failure.
        setChecklist((prev) =>
          prev.map((item) => (item.id === id ? { ...item, completed: previousCompleted } : item)),
        );
        if (err instanceof ApiError && err.status === 404) {
          toast.info('Saving checklist changes is not available yet. Please try again later.');
        } else {
          toast.error('Could not update the checklist item. Please try again.');
        }
      }
    },
    [],
  );

  const completedCount = checklist.filter((item) => item.completed).length;
  const totalCount = checklist.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredIncidents = useMemo(() => {
    if (!incidentStatusFilter) return incidents;
    return incidents.filter((i) => i.status === incidentStatusFilter);
  }, [incidents, incidentStatusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / INCIDENTS_PER_PAGE));
  const paginatedIncidents = useMemo(() => {
    const start = (incidentPage - 1) * INCIDENTS_PER_PAGE;
    return filteredIncidents.slice(start, start + INCIDENTS_PER_PAGE);
  }, [filteredIncidents, incidentPage, INCIDENTS_PER_PAGE]);

  if (isLoading || isRegionLoading) {
    return (
      <MainLayout>
        <LoadingSpinner message="Loading safeguarding data..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <ErrorState message="Failed to load safeguarding data." onRetry={fetchData} />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Compliance', href: '/compliance' },
              { label: 'Safeguarding' },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl text-dark-primary tracking-tight mb-2">Safeguarding</h1>
              <p className="text-grey-600 text-lg">
                {safeguardingFramework} compliance, {officerLabel} details, and incident tracking
              </p>
            </div>
          </div>

          {/* Safeguarding Officer Card */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6 text-brand" />
              <h2 className="font-serif text-2xl sm:text-3xl text-white">{officerLabel}</h2>
            </div>

            {officer ? (
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl bg-brand text-dark-primary shadow-sm flex-shrink-0">
                  {officer.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-white/60 text-sm">Name</p>
                      <p className="text-white font-semibold">{officer.name}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Role</p>
                      <p className="text-white font-semibold">{officer.role}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </p>
                      <p className="text-white font-semibold">{officer.email}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Phone
                      </p>
                      <p className="text-white font-semibold tabular-nums">{officer.phone}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">{backgroundCheckShortLabel} number</p>
                      <p className="text-white font-semibold tabular-nums">{officer.dbsNumber}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> {backgroundCheckShortLabel} expiry
                      </p>
                      <p className="text-white font-semibold tabular-nums">
                        {formatDate(officer.dbsExpiry, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-white/60 text-sm">Qualifications</p>
                    <p className="text-white font-semibold">{officer.qualifications}</p>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title={`No ${officerLabel} on record`}
                description={`Every club needs a designated ${officerLabel} for safeguarding compliance.`}
                actionLabel={`Add ${officerLabel}`}
                actionOnClick={() => setShowAddOfficer(true)}
              />
            )}
          </div>

          {/* Safeguarding Compliance Checklist */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-brand" />
                <h2 className="font-serif text-2xl sm:text-3xl text-white">{safeguardingFramework} compliance checklist</h2>
              </div>
              <span className="text-sm font-bold text-white/60 tabular-nums">
                {completedCount} of {totalCount} complete
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/10 mb-6">
              <div
                className="h-2 rounded-full bg-brand transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="space-y-3">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <label className="-mx-3 -mt-3 px-3 pt-3 pb-3 flex items-start justify-center cursor-pointer min-w-[48px] min-h-[48px]">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <span className="sr-only">{item.requirement}</span>
                    {item.completed ? (
                      <CheckCircle className="w-6 h-6 text-success peer-focus-visible:ring-2 peer-focus-visible:ring-brand rounded-full" />
                    ) : (
                      <XCircle className="w-6 h-6 text-danger peer-focus-visible:ring-2 peer-focus-visible:ring-brand rounded-full" />
                    )}
                  </label>
                  <div className="flex-1">
                    <p className={`font-semibold ${item.completed ? 'text-white' : 'text-danger'}`}>
                      {item.requirement}
                    </p>
                    <p className="text-white/60 text-sm mt-1">{item.description}</p>
                  </div>
                  <ComplianceStatusBadge
                    status={item.completed ? 'compliant' : 'expired'}
                    label={item.completed ? 'Compliant' : 'Action needed'}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Incident Log */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <AlertTriangle className="w-6 h-6 text-warning" />
              <h2 className="font-serif text-2xl sm:text-3xl text-white">Incident log</h2>
            </div>

            {/* Status filter */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <select
                value={incidentStatusFilter}
                onChange={(e) => {
                  setIncidentStatusFilter(e.target.value as '' | 'open' | 'under review' | 'resolved');
                  setIncidentPage(1);
                }}
                className="px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all w-full sm:min-w-[200px]"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="under review">Under review</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {incidents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No incidents recorded"
                description="A clear incident log means nothing has been reported. Any safeguarding concerns you log will appear here."
                actionLabel={null}
              />
            ) : paginatedIncidents.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No incidents found"
                description="No incidents match the selected status."
                actionLabel="Clear filter"
                actionOnClick={() => { setIncidentStatusFilter(''); setIncidentPage(1); }}
              />
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {paginatedIncidents.map((incident) => {
                    const badge = INCIDENT_STATUS_MAP[incident.status];
                    return (
                      <div
                        key={incident.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-white font-semibold text-sm">{incident.category}</p>
                            <p className="text-white/60 text-xs tabular-nums">
                              {formatDate(incident.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                          </div>
                          <ComplianceStatusBadge status={badge.status} label={badge.label} />
                        </div>
                        <p className="text-white/80 text-sm mb-2">{incident.summary}</p>
                        <p className="text-white/60 text-xs">Reported by {incident.reportedBy}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Date</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Category</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Summary</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Reported by</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-white/60 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIncidents.map((incident) => {
                        const badge = INCIDENT_STATUS_MAP[incident.status];
                        return (
                          <tr
                            key={incident.id}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors"
                          >
                            <td className="py-4 px-4">
                              <p className="text-white/80 text-sm tabular-nums">
                                {formatDate(incident.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-white font-semibold text-sm">{incident.category}</p>
                            </td>
                            <td className="py-4 px-4 max-w-md">
                              <p className="text-white/80 text-sm">{incident.summary}</p>
                            </td>
                            <td className="py-4 px-4">
                              <p className="text-white/80 text-sm">{incident.reportedBy}</p>
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

                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                  <p className="text-white/60 text-sm tabular-nums">
                    Showing {Math.min((incidentPage - 1) * INCIDENTS_PER_PAGE + 1, filteredIncidents.length)} to {Math.min(incidentPage * INCIDENTS_PER_PAGE, filteredIncidents.length)} of {filteredIncidents.length} records
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIncidentPage((p) => Math.max(1, p - 1))}
                      disabled={incidentPage === 1}
                      className="px-4 py-2 min-h-[44px] rounded-button font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border border-white/10 text-white hover:border-brand"
                    >
                      Previous
                    </button>
                    <span className="text-white/60 text-sm tabular-nums">
                      Page {incidentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setIncidentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={incidentPage === totalPages}
                      className="px-4 py-2 min-h-[44px] rounded-button font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border border-white/10 text-white hover:border-brand"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {showAddOfficer && (
        <AddOfficerModal
          officerLabel={officerLabel}
          certificateLabel={`${backgroundCheckShortLabel} number`}
          onClose={() => setShowAddOfficer(false)}
          onCreated={fetchData}
        />
      )}
    </MainLayout>
  );
}
