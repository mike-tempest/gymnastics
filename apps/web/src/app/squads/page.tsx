'use client';

import {
  Squad,
  DISCIPLINE_LABELS,
  DISCIPLINE_SHORT_LABELS,
  ORDERED_DISCIPLINES,
  SquadType,
  SQUAD_TYPE_LABELS,
} from '@club-manager/shared-types';
import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import SquadModal, { type SquadSubmitData } from '@/components/squads/SquadModal';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/hooks/useConfirm';
import { createSquad, updateSquad, deleteSquad } from '@/lib/api/squads';
import { MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { useSquads } from '@/lib/hooks/useSquads';

export default function SquadsPage() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: squadsData, isLoading, error, refetch: refetchSquads } = useSquads();
  const squads = squadsData ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Filters. A club runs its recreational classes and its competitive squads
  // from this one list, so type is usually the first thing an admin narrows by.
  const [typeFilter, setTypeFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');

  const displayError = error || mutationError;

  const filteredSquads = useMemo(() => {
    return squads.filter((squad) => {
      if (typeFilter && squad.squad_type !== typeFilter) return false;
      if (disciplineFilter && squad.discipline !== disciplineFilter) return false;
      return true;
    });
  }, [squads, typeFilter, disciplineFilter]);

  const hasFilters = !!typeFilter || !!disciplineFilter;

  const clearFilters = () => {
    setTypeFilter('');
    setDisciplineFilter('');
  };

  const handleOpenAddModal = () => {
    setSelectedSquad(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (squad: Squad) => {
    setSelectedSquad(squad);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSquad(null);
  };

  const handleSubmit = async (data: SquadSubmitData) => {
    try {
      setIsSubmitting(true);
      setMutationError(null);

      if (selectedSquad) {
        // Update existing squad
        await updateSquad(selectedSquad.squad_id, data);
        toast.success('Squad updated successfully');
      } else {
        // Create new squad
        await createSquad(data);
        toast.success('Squad created successfully');
      }

      // Refresh squads list
      refetchSquads();

      // Close modal
      handleCloseModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save squad';
      setMutationError(message);
      toast.error(message);
      throw err; // Re-throw to keep modal open
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (squad: Squad) => {
    const confirmed = await confirm({
      title: 'Delete Squad?',
      description: `Are you sure you want to delete "${squad.squad_name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Squad',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteSquad(squad.squad_id);
      refetchSquads();
      toast.success('Squad deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete squad';
      setMutationError(message);
      toast.error(message);
    }
  };

  const totalMembers = squads.reduce((sum, squad) => sum + (squad.member_count || 0), 0);

  return (
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-5xl md:text-6xl text-dark-primary tracking-tight mb-2">Squads</h1>
              <p className="text-grey-600 text-lg">Manage your club&apos;s training squads</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
            >
              <span>Add Squad</span>
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

          {/* Error Message */}
          {displayError && <ErrorState message={displayError} onRetry={refetchSquads} />}

          {/* Large Stats Card */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">Total Squads</p>
                <h2 className="text-5xl sm:text-8xl font-bold text-dark-primary mb-4">
                  {displayError ? '—' : squads.length}
                  {!displayError && <span className="text-4xl">+</span>}
                </h2>
                <p className="text-grey-600 text-lg">{displayError ? 'Unable to load' : 'Active Training Groups'}</p>
              </div>
              <div className="flex flex-row sm:flex-col gap-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Total {MEMBER_NOUN_PLURAL}</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold">{displayError ? '—' : totalMembers}</p>
                </div>
                <div className="bg-white rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Avg per Squad</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold">
                    {displayError ? '—' : squads.length > 0 ? Math.round(totalMembers / squads.length) : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Squads List */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <h2 className="font-serif text-2xl sm:text-4xl text-white tracking-tight">All Squads</h2>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by squad type"
                className="w-full sm:w-auto px-4 py-3 bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none min-h-[44px] sm:min-w-[200px]"
              >
                <option value="">All Types</option>
                {Object.values(SquadType).map((type) => (
                  <option key={type} value={type}>
                    {SQUAD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                aria-label="Filter by discipline"
                className="w-full sm:w-auto px-4 py-3 bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none min-h-[44px] sm:min-w-[240px]"
              >
                <option value="">All Disciplines</option>
                {ORDERED_DISCIPLINES.map((discipline) => (
                  <option key={discipline} value={discipline}>
                    {DISCIPLINE_LABELS[discipline]}
                  </option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <LoadingSpinner message='Loading squads...' />
            ) : squads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No squads yet"
                description={`Squads group ${MEMBER_NOUN_PLURAL_LOWER} by age, discipline or ability, from recreational badge classes through to the competitive pathway.`}
                hint="Most clubs start with 2-4 squads. You can reorganise later."
                actionLabel="Create Squad"
                actionHref="/squads/new"
              />
            ) : filteredSquads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No squads found"
                description="No squads match your filters"
                actionLabel="Clear Filters"
                actionOnClick={clearFilters}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {hasFilters && (
                  <p className="text-text-secondary text-sm md:col-span-2 lg:col-span-3">
                    Showing {filteredSquads.length} of {squads.length} squad
                    {squads.length !== 1 ? 's' : ''}
                  </p>
                )}
                {filteredSquads.map((squad) => (
                  <div
                    key={squad.squad_id}
                    className="p-6 bg-white/8 rounded-2xl border border-white/10 hover:border-brand transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-white mb-2">{squad.squad_name}</h3>
                        {(squad.squad_type || squad.level || squad.discipline) && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {squad.squad_type && (
                              <span className="px-3 py-1 bg-brand/20 text-brand text-xs font-bold rounded-full border border-brand">
                                {SQUAD_TYPE_LABELS[squad.squad_type]}
                              </span>
                            )}
                            {squad.level && (
                              <span className="px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full border border-white/20">
                                {squad.level}
                              </span>
                            )}
                            {squad.discipline && (
                              <span
                                className="px-3 py-1 bg-white/10 text-white text-xs font-bold rounded-full border border-white/20"
                                title={DISCIPLINE_LABELS[squad.discipline]}
                              >
                                {DISCIPLINE_SHORT_LABELS[squad.discipline]}
                              </span>
                            )}
                          </div>
                        )}
                        {squad.description && (
                          <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                            {squad.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {squad.coach_name && (
                        <div className="flex items-center text-sm">
                          <svg
                            className="w-5 h-5 mr-2 text-brand"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                          </svg>
                          <span className="text-text-secondary">{squad.coach_name}</span>
                        </div>
                      )}

                      {squad.training_times && (
                        <div className="flex items-start text-sm">
                          <svg
                            className="w-5 h-5 mr-2 text-brand flex-shrink-0 mt-0.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                          </svg>
                          <span className="text-text-secondary">{squad.training_times}</span>
                        </div>
                      )}

                      {(squad.min_age !== null || squad.max_age !== null) && (
                        <div className="flex items-center text-sm">
                          <svg
                            className="w-5 h-5 mr-2 text-brand"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                          <span className="text-text-secondary">
                            Ages {squad.min_age || '0'} - {squad.max_age || '99'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Capacity indicator */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-text-secondary">Capacity</span>
                        <span className="text-white font-semibold">
                          {squad.member_count || 0}
                          {squad.max_capacity ? ` / ${squad.max_capacity}` : ''}
                        </span>
                      </div>
                      {squad.max_capacity && (
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div
                            className="bg-brand rounded-full h-2 transition-all"
                            style={{
                              width: `${Math.min(
                                ((squad.member_count || 0) / squad.max_capacity) * 100,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => router.push(`/squads/${squad.squad_id}`)}
                        className="w-full px-4 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2"
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
                          <path d="M9 5l7 7-7 7"></path>
                        </svg>
                      </button>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(squad);
                          }}
                          className="flex-1 px-4 py-2 min-h-[44px] bg-dark-primary/80 text-white rounded-button font-semibold hover:bg-white/10 transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(squad);
                          }}
                          className="flex-1 px-4 py-2 min-h-[44px] bg-dark-primary/80 text-text-secondary rounded-button font-semibold hover:bg-red-500 hover:text-white transition-all"
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

      {/* Modal */}
      <SquadModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        squad={selectedSquad}
        isLoading={isSubmitting}
      />
    </MainLayout>
  );
}
