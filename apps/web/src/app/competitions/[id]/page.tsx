'use client';

import { CompetitionStatus } from '@swim-nexus/shared-types';
import { ArrowLeft, Trophy, ClipboardList, Medal } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useState } from 'react';

import EntryManagement from '@/components/competitions/EntryManagement';
import ExportButton from '@/components/competitions/ExportButton';
import ImportWizard from '@/components/competitions/ImportWizard';
import ResultsView from '@/components/competitions/ResultsView';
import TimesImportModal from '@/components/competitions/TimesImportModal';
import MainLayout from '@/components/layout/MainLayout';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import {
  COMPETITION_STATUS_STYLES,
  COMPETITION_STATUS_LABELS,
  competitionTypeLabels,
  formatCompetitionDate,
  courseLabel,
} from '@/lib/competitions-utils';
import { isCompetitionsEnabled } from '@/lib/features';
import { useCompetition } from '@/lib/hooks/useCompetitions';

function statusBadge(status: CompetitionStatus) {
  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${COMPETITION_STATUS_STYLES[status]}`}>
      {COMPETITION_STATUS_LABELS[status]}
    </span>
  );
}

type Tab = 'entries' | 'results';

export default function CompetitionDetailPage() {
  // Swimming times/strokes module, feature-flagged off by default (TEM-15).
  // The gate lives in a hook-free wrapper so the content component keeps its
  // unconditional hook order.
  if (!isCompetitionsEnabled()) {
    notFound();
  }
  return <CompetitionDetailPageContent />;
}

function CompetitionDetailPageContent() {
  const params = useParams();
  const id = params.id as string;
  const { data: competition, isLoading, error, refetch } = useCompetition(id);
  const { locale, country } = useClubRegion();
  const typeLabels = competitionTypeLabels(country);
  const [activeTab, setActiveTab] = useState<Tab>('entries');
  const [showImport, setShowImport] = useState(false);
  const [showTimesImport, setShowTimesImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-2 text-grey-600 hover:text-dark-primary transition-colors mb-6 min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Competitions</span>
          </Link>

          {isLoading && <LoadingSpinner message="Loading competition..." />}
          {error && <ErrorState message={error} onRetry={refetch} />}

          {competition && (
            <>
              <div className="bg-dark-primary rounded-3xl shadow-lg p-6 sm:p-10 border border-white/10 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-brand" />
                      </div>
                      {statusBadge(competition.status)}
                    </div>
                    <h1 className="font-serif text-4xl sm:text-5xl text-white tracking-tight mb-2">
                      {competition.name}
                    </h1>
                    <p className="text-text-secondary text-lg">
                      {typeLabels[competition.type]}
                      {' \u00B7 '}
                      {courseLabel(competition.course)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4">
                    <p className="text-text-secondary text-sm mb-1">Date</p>
                    <p className="text-white font-semibold">
                      {formatCompetitionDate(competition.start_date, locale)}
                      {competition.end_date && competition.end_date !== competition.start_date
                        ? ` - ${formatCompetitionDate(competition.end_date, locale)}`
                        : ''}
                    </p>
                  </div>
                  {competition.venue && (
                    <div className="bg-white/5 rounded-2xl p-4">
                      <p className="text-text-secondary text-sm mb-1">Venue</p>
                      <p className="text-white font-semibold">{competition.venue}</p>
                    </div>
                  )}
                  {competition.organiser && (
                    <div className="bg-white/5 rounded-2xl p-4">
                      <p className="text-text-secondary text-sm mb-1">Organiser</p>
                      <p className="text-white font-semibold">{competition.organiser}</p>
                    </div>
                  )}
                  {competition.entry_deadline && (
                    <div className="bg-white/5 rounded-2xl p-4">
                      <p className="text-text-secondary text-sm mb-1">Entry Deadline</p>
                      <p className="text-white font-semibold">{formatCompetitionDate(competition.entry_deadline, locale)}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 overflow-hidden">
                <div className="flex border-b border-white/10">
                  <button
                    onClick={() => setActiveTab('entries')}
                    className={`flex items-center gap-2 px-6 py-4 min-h-[44px] font-semibold text-sm transition-all ${
                      activeTab === 'entries'
                        ? 'text-brand border-b-2 border-brand bg-white/5'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <ClipboardList className="w-5 h-5" />
                    Entries
                  </button>
                  <button
                    onClick={() => setActiveTab('results')}
                    className={`flex items-center gap-2 px-6 py-4 min-h-[44px] font-semibold text-sm transition-all ${
                      activeTab === 'results'
                        ? 'text-brand border-b-2 border-brand bg-white/5'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Medal className="w-5 h-5" />
                    Results
                  </button>
                </div>

                <div className="p-6 sm:p-8">
                  {activeTab === 'entries' && (
                    <EntryManagement competitionId={id} />
                  )}

                  {activeTab === 'results' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setShowTimesImport(true)}
                          className="px-4 py-2.5 min-h-[44px] bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-semibold text-sm transition-colors"
                        >
                          Import Times (CSV)
                        </button>
                        <button
                          onClick={() => setShowImport(true)}
                          className="px-4 py-2.5 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold text-sm hover:bg-brand-light transition-colors"
                        >
                          Import Results
                        </button>
                        <ExportButton competitionId={id} />
                      </div>
                      <ResultsView key={refreshKey} competitionId={id} />
                    </div>
                  )}

                  <ImportWizard
                    competitionId={id}
                    isOpen={showImport}
                    onClose={() => setShowImport(false)}
                    onImportComplete={() => {
                      setShowImport(false);
                      setRefreshKey((k) => k + 1);
                    }}
                  />

                  {showTimesImport && (
                    <TimesImportModal
                      competitionId={id}
                      onClose={() => setShowTimesImport(false)}
                      onImportComplete={() => {
                        setShowTimesImport(false);
                        setRefreshKey((k) => k + 1);
                      }}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
