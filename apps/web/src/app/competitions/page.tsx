'use client';

import { Competition, CompetitionStatus } from '@swim-nexus/shared-types';
import { Trophy } from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import CompetitionModal from '@/components/competitions/CompetitionModal';
import MainLayout from '@/components/layout/MainLayout';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import {
  createCompetition,
  updateCompetition,
  deleteCompetition,
  CreateCompetitionInput,
  UpdateCompetitionInput,
} from '@/lib/api/competitions';
import {
  COMPETITION_STATUS_STYLES,
  COMPETITION_STATUS_LABELS,
  competitionTypeLabels,
  formatCompetitionDate,
  courseLabel,
} from '@/lib/competitions-utils';
import { isCompetitionsEnabled } from '@/lib/features';
import { useCompetitions } from '@/lib/hooks/useCompetitions';

function statusBadge(status: CompetitionStatus) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${COMPETITION_STATUS_STYLES[status]}`}>
      {COMPETITION_STATUS_LABELS[status]}
    </span>
  );
}

export default function CompetitionsPage() {
  // Swimming times/strokes module, feature-flagged off by default (TEM-15).
  // The gate lives in a hook-free wrapper so the content component keeps its
  // unconditional hook order.
  if (!isCompetitionsEnabled()) {
    notFound();
  }
  return <CompetitionsPageContent />;
}

function CompetitionsPageContent() {
  const router = useRouter();
  const { data: competitionsData, isLoading, error, refetch: refetchCompetitions } = useCompetitions();
  const { locale, country } = useClubRegion();
  const typeLabels = competitionTypeLabels(country);
  const eventNoun = country === 'AU' ? 'carnivals' : 'galas';
  const competitions = competitionsData ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const displayError = error || mutationError;

  const handleOpenAddModal = () => {
    setSelectedCompetition(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (competition: Competition) => {
    setSelectedCompetition(competition);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCompetition(null);
  };

  const handleSubmit = async (data: CreateCompetitionInput | UpdateCompetitionInput) => {
    try {
      setIsSubmitting(true);
      setMutationError(null);

      if (selectedCompetition) {
        await updateCompetition(selectedCompetition.competition_id, data);
        toast.success('Competition updated successfully');
      } else {
        await createCompetition(data as CreateCompetitionInput);
        toast.success('Competition created successfully');
      }

      refetchCompetitions();
      handleCloseModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save competition';
      setMutationError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (competitionId: string) => {
    if (!confirm('Are you sure you want to delete this competition?')) {
      return;
    }

    try {
      await deleteCompetition(competitionId);
      refetchCompetitions();
      toast.success('Competition deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete competition';
      setMutationError(message);
      toast.error(message);
    }
  };

  const openCount = competitions.filter((c) => c.status === CompetitionStatus.OPEN).length;
  const upcomingCount = competitions.filter((c) =>
    c.status === CompetitionStatus.DRAFT || c.status === CompetitionStatus.OPEN
  ).length;

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-5xl md:text-6xl text-dark-primary tracking-tight mb-2">Competitions</h1>
              <p className="text-grey-600 text-lg">Manage meets, {eventNoun}, and competition entries</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
            >
              <span>Add Competition</span>
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M17 8l4 4m0 0l-4 4m4-4H3"></path>
              </svg>
            </button>
          </div>

          {displayError && <ErrorState message={displayError} onRetry={refetchCompetitions} />}

          {/* Stats Card */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">Total Competitions</p>
                <h2 className="text-5xl sm:text-8xl font-bold text-dark-primary mb-4">
                  {displayError ? '\u2014' : competitions.length}
                  {!displayError && <span className="text-4xl">+</span>}
                </h2>
                <p className="text-grey-600 text-lg">{displayError ? 'Unable to load' : 'This Season'}</p>
              </div>
              <div className="flex flex-row sm:flex-col gap-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Open for Entry</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold">{displayError ? '\u2014' : openCount}</p>
                </div>
                <div className="bg-white rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Upcoming</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold">{displayError ? '\u2014' : upcomingCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Competitions List */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl sm:text-4xl text-white tracking-tight">All Competitions</h2>
            </div>

            {isLoading ? (
              <LoadingSpinner message="Loading competitions..." />
            ) : competitions.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No competitions yet"
                description={`Competitions track meets, ${eventNoun}, and events your swimmers enter.`}
                hint="Add your first competition to start managing entries and results."
                actionLabel="Add Competition"
                actionOnClick={handleOpenAddModal}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {competitions.map((competition) => (
                  <div
                    key={competition.competition_id}
                    className="p-6 bg-white/5 rounded-2xl hover:border-brand transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {statusBadge(competition.status)}
                          <span className="text-xs text-text-secondary">
                            {typeLabels[competition.type]}
                          </span>
                        </div>
                        <h3 className="font-bold text-xl text-white mb-1">{competition.name}</h3>
                        {competition.venue && (
                          <p className="text-sm text-text-secondary line-clamp-1">{competition.venue}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center text-sm">
                        <svg
                          className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-text-secondary">
                          {formatCompetitionDate(competition.start_date, locale)}
                          {competition.end_date && competition.end_date !== competition.start_date
                            ? ` - ${formatCompetitionDate(competition.end_date, locale)}`
                            : ''}
                        </span>
                      </div>

                      {competition.organiser && (
                        <div className="flex items-center text-sm">
                          <svg
                            className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="text-text-secondary">{competition.organiser}</span>
                        </div>
                      )}

                      <div className="flex items-center text-sm">
                        <svg
                          className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span className="text-text-secondary">
                          {courseLabel(competition.course)}
                        </span>
                      </div>

                      {competition.entry_deadline && (
                        <div className="flex items-center text-sm">
                          <svg
                            className="w-5 h-5 mr-2 text-brand flex-shrink-0"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-text-secondary">
                            Deadline: {formatCompetitionDate(competition.entry_deadline, locale)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => router.push(`/competitions/${competition.competition_id}`)}
                        className="w-full px-4 py-3 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2"
                      >
                        <span>View Details</span>
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(competition);
                          }}
                          className="flex-1 px-4 py-2 min-h-[44px] bg-white/5 text-white rounded-button font-semibold hover:bg-dark-primary transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(competition.competition_id);
                          }}
                          className="flex-1 px-4 py-2 min-h-[44px] bg-white/5 text-text-secondary rounded-button font-semibold hover:bg-red-500 hover:text-white transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CompetitionModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        competition={selectedCompetition}
        isLoading={isSubmitting}
      />
    </MainLayout>
  );
}
