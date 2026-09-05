'use client';

import { GOVERNING_BODY_LABELS } from '@club-manager/shared-types';
import { Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import AttendanceHistory from '@/components/swimmers/AttendanceHistory';
import DeleteConfirmModal from '@/components/swimmers/DeleteConfirmModal';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { deleteSwimmer } from '@/lib/api/swimmers';
import { isCompetitionsEnabled } from '@/lib/features';
import { useSwimmer, useSquad } from '@/lib/hooks';

// Loaded lazily so the recharts-heavy times UI stays out of the route chunk
// while the competitions module is flagged off (TEM-15).
const PersonalBests = dynamic(() => import('@/components/swimmers/PersonalBests'), {
  ssr: false,
});

export default function SwimmerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { formatDate } = useFormatters();
  const { data: swimmer, isLoading: swimmerLoading, error: swimmerError, refetch: refetchSwimmer } = useSwimmer(params.id);
  const { data: squad } = useSquad(swimmer?.squad_id ?? undefined);
  const isLoading = swimmerLoading;
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    if (!swimmer) return;
    try {
      setIsDeleting(true);
      await deleteSwimmer(swimmer.swimmer_id);
      toast.success('Swimmer removed successfully');
      router.push('/swimmers');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove swimmer';
      setError(message);
      toast.error(message);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatGender = (gender: string): string => {
    switch (gender) {
      case 'M':
        return 'Male';
      case 'F':
        return 'Female';
      default:
        return 'Other';
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <LoadingSpinner message="Loading swimmer details..." />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!swimmer) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            {swimmerError ? (
              <ErrorState message={swimmerError} onRetry={refetchSwimmer} />
            ) : (
              <EmptyState
                icon={Users}
                title="Swimmer not found"
                description="This swimmer could not be found. They may have been removed."
                actionLabel="Back to Swimmers"
                actionHref="/swimmers"
              />
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Swimmers', href: '/swimmers' },
              { label: `${swimmer.first_name} ${swimmer.last_name}` },
            ]}
          />
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
            <div>
              <div className="flex items-center space-x-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand rounded-full flex items-center justify-center font-bold text-dark-primary text-xl sm:text-2xl shadow-sm">
                  {swimmer.first_name.charAt(0)}
                  {swimmer.last_name.charAt(0)}
                </div>
                <div>
                  <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">
                    {swimmer.first_name} {swimmer.last_name}
                  </h1>
                  <p className="text-grey-600 text-lg">
                    {calculateAge(swimmer.dob)} years old • {formatGender(swimmer.gender)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full sm:w-auto px-6 py-3 sm:py-4 bg-dark-primary/80 text-red-400 rounded-button font-bold hover:bg-red-500 hover:bg-opacity-20 transition-all flex items-center justify-center space-x-3 text-base sm:text-lg border border-white/20 min-h-[44px]"
                aria-label="Remove swimmer"
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
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Remove</span>
              </button>
              <Link
                href={`/swimmers?edit=${swimmer.swimmer_id}`}
                className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg min-h-[44px]"
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
                <span>Edit Swimmer</span>
              </Link>
            </div>
          </div>

          {/* Error Message */}
          {(error || swimmerError) && (
            <div className="mb-8">
              <ErrorState
                message={error || swimmerError || 'Something went wrong. Please try again.'}
                onRetry={() => {
                  setError(null);
                  refetchSwimmer();
                }}
              />
            </div>
          )}

          {/* Info Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Date of Birth */}
            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20">
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
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                </svg>
                <span className="text-text-secondary text-sm font-semibold">Date of Birth</span>
              </div>
              <p className="text-white text-xl font-bold">
                {formatDate(swimmer.dob, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>

            {/* Gender */}
            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20">
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
                <span className="text-text-secondary text-sm font-semibold">Gender</span>
              </div>
              <p className="text-white text-xl font-bold">{formatGender(swimmer.gender)}</p>
            </div>

            {/* Registration */}
            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20">
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
                  <path d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"></path>
                </svg>
                <span className="text-text-secondary text-sm font-semibold">Registration</span>
              </div>
              <p className="text-white text-xl font-bold">
                {swimmer.se_number ? (
                  <>
                    {swimmer.governing_body && (
                      <span className="block text-sm font-semibold text-text-secondary">
                        {GOVERNING_BODY_LABELS[swimmer.governing_body]}
                      </span>
                    )}
                    {swimmer.se_number}
                  </>
                ) : (
                  <span className="text-text-tertiary">Not registered</span>
                )}
              </p>
            </div>
          </div>

          {/* Squad Assignment */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20 mb-8">
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
                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              <h2 className="font-serif text-2xl text-white">Squad Assignment</h2>
            </div>
            {squad ? (
              <Link
                href={`/squads/${squad.squad_id}`}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-brand transition-all group min-h-[44px]"
              >
                <div>
                  <p className="text-white font-bold text-lg">{squad.squad_name}</p>
                  {squad.coach_name && (
                    <p className="text-text-secondary text-sm">Coach: {squad.coach_name}</p>
                  )}
                  {squad.training_times && (
                    <p className="text-text-secondary text-sm">{squad.training_times}</p>
                  )}
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
              </Link>
            ) : (
              <p className="text-white/60 text-lg">No squad assigned</p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20 mb-8">
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
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
              <h2 className="font-serif text-2xl text-white">Emergency Contact</h2>
            </div>
            <p className="text-white/60 text-lg">
              {swimmer.emergency_contact || 'No emergency contact recorded'}
            </p>
          </div>

          {/* Medical Notes */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20 mb-8">
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
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h2 className="font-serif text-2xl text-white">Medical Notes</h2>
            </div>
            <p className="text-white/60 text-lg whitespace-pre-wrap">
              {swimmer.medical_notes || 'No medical notes recorded'}
            </p>
          </div>

          {/* Personal Bests: swimming times, feature-flagged off by default (TEM-15) */}
          {isCompetitionsEnabled() && (
            <div className="bg-dark-primary rounded-3xl shadow-lg p-6 md:p-8 border border-white/20 mb-8">
              <PersonalBests swimmerId={params.id} />
            </div>
          )}

          {/* Attendance History */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-6 border border-white/20">
            <AttendanceHistory swimmerId={params.id} />
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        swimmerName={`${swimmer.first_name} ${swimmer.last_name}`}
        isDeleting={isDeleting}
      />
    </MainLayout>
  );
}
