'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import SquadModal from '@/components/squads/SquadModal';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/hooks/useConfirm';
import { deleteSquad, updateSquad } from '@/lib/api/squads';
import { useSquad, useSquadSwimmers } from '@/lib/hooks';

export default function SquadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: squad, isLoading: squadLoading, error: squadError, refetch: refetchSquad } = useSquad(params.id);
  const { data: swimmersData, isLoading: swimmersLoading, refetch: refetchSwimmers } = useSquadSwimmers(params.id);
  const swimmers = swimmersData || [];
  const isLoading = squadLoading || swimmersLoading;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSquadData = () => {
    refetchSquad();
    refetchSwimmers();
  };

  const handleOpenEditModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (data: {
    squad_name: string;
    description?: string;
    min_age?: number | null;
    max_age?: number | null;
    coach_name?: string;
    training_times?: string;
    max_capacity?: number | null;
  }) => {
    if (!squad) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await updateSquad(squad.squad_id, data);
      await fetchSquadData();
      handleCloseModal();
      toast.success('Squad updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update squad';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!squad) return;

    const confirmed = await confirm({
      title: 'Delete Squad?',
      description: `Are you sure you want to delete "${squad.squad_name}"? This action cannot be undone.`,
      confirmLabel: 'Delete Squad',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      await deleteSquad(squad.squad_id);
      toast.success('Squad deleted successfully');
      router.push('/squads');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete squad';
      setError(message);
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <LoadingSpinner message="Loading squad details..." />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (squadError && !squad) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <ErrorState message={squadError} onRetry={fetchSquadData} />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!squad) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <EmptyState
              icon={Users}
              title="Squad not found"
              description="This squad may have been deleted or the link is incorrect."
              actionLabel="Back to Squads"
              actionHref="/squads"
            />
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Squads', href: '/squads' },
              { label: squad.squad_name },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-5xl md:text-6xl text-dark-primary tracking-tight mb-2">{squad.squad_name}</h1>
              {squad.description && (
                <p className="text-grey-600 text-lg">{squad.description}</p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleOpenEditModal}
                className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                <span>Edit Squad</span>
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-dark-primary/80 text-text-secondary rounded-button font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center space-x-3 text-base sm:text-lg disabled:opacity-50"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                <span>Delete Squad</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {(error || squadError) && (
            <ErrorState
              message={error || squadError || 'Something went wrong. Please try again.'}
              onRetry={() => { setError(null); fetchSquadData(); }}
            />
          )}

          {/* Squad Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {squad.coach_name && (
              <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
                <div className="flex items-center mb-2">
                  <svg
                    className="w-6 h-6 mr-3 text-brand"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                  <span className="text-text-secondary text-sm font-semibold">Coach</span>
                </div>
                <p className="text-white text-xl font-bold">{squad.coach_name}</p>
              </div>
            )}

            {(squad.min_age !== null || squad.max_age !== null) && (
              <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
                <div className="flex items-center mb-2">
                  <svg
                    className="w-6 h-6 mr-3 text-brand"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <span className="text-text-secondary text-sm font-semibold">Age Range</span>
                </div>
                <p className="text-white text-xl font-bold">
                  {squad.min_age || '0'} - {squad.max_age || '99'} years
                </p>
              </div>
            )}

            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10">
              <div className="flex items-center mb-2">
                <svg
                  className="w-6 h-6 mr-3 text-brand"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                <span className="text-text-secondary text-sm font-semibold">Capacity</span>
              </div>
              <p className="text-white text-xl font-bold">
                {squad.swimmer_count || 0}
                {squad.max_capacity ? ` / ${squad.max_capacity}` : ''} swimmers
              </p>
              {squad.max_capacity && (
                <div className="mt-3 w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-brand rounded-full h-2 transition-all"
                    style={{
                      width: `${Math.min(
                        ((squad.swimmer_count || 0) / squad.max_capacity) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>
          </div>

          {/* Training Times */}
          {squad.training_times && (
            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/10 mb-8">
              <div className="flex items-center mb-3">
                <svg
                  className="w-6 h-6 mr-3 text-brand"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h2 className="font-serif text-2xl text-white">Training Times</h2>
              </div>
              <p className="text-text-secondary text-lg whitespace-pre-wrap">{squad.training_times}</p>
            </div>
          )}

          {/* Swimmers List */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl sm:text-4xl text-white tracking-tight">Squad Members</h2>
              <span className="text-text-secondary text-lg tabular-nums">
                {swimmers.length} {swimmers.length === 1 ? 'swimmer' : 'swimmers'}
              </span>
            </div>

            {swimmers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No swimmers in this squad yet"
                description="Assign swimmers to this squad to track attendance and progress together."
                hint="Use Edit Squad to add members, or add a swimmer to this squad from their profile."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {swimmers.map((swimmer) => (
                  <div
                    key={swimmer.swimmer_id}
                    className="p-6 bg-white/8 rounded-2xl border border-white/10 hover:border-brand transition-all group cursor-pointer"
                    onClick={() => router.push(`/swimmers/${swimmer.swimmer_id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-white mb-1">
                          {swimmer.first_name} {swimmer.last_name}
                        </h3>
                      </div>
                      <svg
                        className="w-5 h-5 text-brand opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M9 5l7 7-7 7"></path>
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <SquadModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        squad={squad}
        isLoading={isSubmitting}
      />
    </MainLayout>
  );
}
