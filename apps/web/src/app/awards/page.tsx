'use client';

import { UserRole } from '@club-manager/shared-types';
import { Award, ClipboardCheck, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import LevelModal from '@/components/awards/LevelModal';
import RiseBridgeCard from '@/components/awards/RiseBridgeCard';
import SchemeModal from '@/components/awards/SchemeModal';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/hooks/useConfirm';
import { useFormatters } from '@/hooks/useFormatters';
import {
  AwardLevel,
  AwardScheme,
  CreateAwardLevelInput,
  CreateAwardSchemeInput,
  createAwardLevel,
  createAwardScheme,
  deleteAwardLevel,
  deleteAwardScheme,
  feeAmount,
  getAwardSchemes,
  installDefaultSchemes,
  updateAwardLevel,
  updateAwardScheme,
} from '@/lib/api/awards';
import { MEMBER_NOUN_LOWER } from '@/lib/brand';
import { useRole } from '@/lib/hooks/useRole';

const SOURCE_LABELS: Record<string, string> = {
  'bg-rise': 'British Gymnastics Rise',
  'legacy-proficiency': 'Legacy Proficiency Awards',
  custom: 'Our own scheme',
};

export default function AwardsPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const { formatCurrency } = useFormatters();
  const { role } = useRole();
  // Deliberately SUPER_ADMIN alone rather than the broader isAdmin (which also
  // covers a treasurer): every write below is @Roles(SUPER_ADMIN) on the API,
  // so showing these controls to anyone else offers buttons that only 403.
  const canManage = role === UserRole.SUPER_ADMIN;

  const [schemes, setSchemes] = useState<AwardScheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<AwardScheme | null>(null);
  const [levelModalScheme, setLevelModalScheme] = useState<AwardScheme | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<AwardLevel | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSchemes(await getAwardSchemes(true));
    } catch {
      setError('Could not load the award schemes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleInstallDefaults = async () => {
    try {
      setIsSubmitting(true);
      const result = await installDefaultSchemes();
      if (result.installed.length > 0) {
        toast.success(`Added ${result.installed.join(' and ')}`);
      }
      if (result.skipped.length > 0) {
        toast.success(`${result.skipped.join(' and ')} were already set up and were left alone`);
      }
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the starter schemes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSchemeSubmit = async (data: CreateAwardSchemeInput) => {
    try {
      setIsSubmitting(true);
      if (selectedScheme) {
        await updateAwardScheme(selectedScheme.scheme_id, data);
        toast.success('Award scheme updated');
      } else {
        await createAwardScheme(data);
        toast.success('Award scheme created');
      }
      await fetchData();
      setSchemeModalOpen(false);
      setSelectedScheme(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the award scheme');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScheme = async (scheme: AwardScheme) => {
    const confirmed = await confirm({
      title: 'Delete award scheme',
      description: `Delete "${scheme.name}" and all of its badges? Any badge history recorded against it is deleted too. This cannot be undone.`,
      confirmLabel: 'Delete scheme',
      cancelLabel: 'Keep scheme',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteAwardScheme(scheme.scheme_id);
      toast.success('Award scheme deleted');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the award scheme');
    }
  };

  const handleLevelSubmit = async (data: Omit<CreateAwardLevelInput, 'scheme_id'>) => {
    if (!levelModalScheme) return;
    try {
      setIsSubmitting(true);
      if (selectedLevel) {
        await updateAwardLevel(selectedLevel.level_id, data);
        toast.success('Badge updated');
      } else {
        await createAwardLevel({ ...data, scheme_id: levelModalScheme.scheme_id });
        toast.success('Badge added');
      }
      await fetchData();
      setLevelModalScheme(null);
      setSelectedLevel(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the badge');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLevel = async (level: AwardLevel) => {
    const confirmed = await confirm({
      title: 'Delete badge',
      description: `Delete "${level.name}"? Any record of this badge being awarded is deleted too. This cannot be undone.`,
      confirmLabel: 'Delete badge',
      cancelLabel: 'Keep badge',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteAwardLevel(level.level_id);
      toast.success('Badge deleted');
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the badge');
    }
  };

  const totalBadges = schemes.reduce((total, scheme) => total + scheme.levels.length, 0);
  const activeSchemes = schemes.filter((scheme) => scheme.active);

  return (
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Badges' }]} />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">
                Badges
              </h1>
              <p className="text-grey-600 text-lg">
                Award schemes, badge fees and assessment records
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/awards/assess"
                className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[48px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center gap-3 text-base sm:text-lg"
              >
                <ClipboardCheck className="w-6 h-6" />
                <span>Assess and award</span>
              </Link>
              {canManage && (
                <button
                  onClick={() => {
                    setSelectedScheme(null);
                    setSchemeModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[48px] bg-white text-dark-primary rounded-button font-bold border border-grey-200 hover:bg-grey-50 transition-all flex items-center justify-center gap-3 text-base sm:text-lg"
                >
                  <Plus className="w-6 h-6" />
                  <span>New scheme</span>
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">Award schemes in use</p>
                <h2 className="text-5xl sm:text-8xl font-bold text-dark-primary mb-4 tabular-nums">
                  {activeSchemes.length}
                </h2>
                <p className="text-grey-600 text-lg">
                  Schemes are your own records, so rename, reprice and reorder them freely
                </p>
              </div>
              <div className="flex flex-row sm:flex-col gap-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Badges</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold tabular-nums">
                    {totalBadges}
                  </p>
                </div>
                <div className="bg-white rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Not in use</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold tabular-nums">
                    {schemes.length - activeSchemes.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Schemes */}
          {isLoading ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6">
              <LoadingSpinner message="Loading award schemes..." size="md" />
            </div>
          ) : error ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6">
              <ErrorState message={error} onRetry={fetchData} />
            </div>
          ) : schemes.length === 0 ? (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6">
              <EmptyState
                icon={Award}
                title="No award schemes yet"
                description="Badges are your own records here, so you can run British Gymnastics Rise, the legacy Proficiency Awards, your own scheme, or all three side by side."
                hint={
                  canManage
                    ? 'Adding the starter schemes gives you Rise and the legacy awards to edit, rather than something fixed.'
                    : 'An administrator sets the schemes up.'
                }
                actionLabel={canManage ? 'Add the starter schemes' : null}
                actionOnClick={canManage ? handleInstallDefaults : undefined}
                features={[
                  'Rise Discover, Explore and Excel as editable badges',
                  'A badge fee that invoices the family and collects by Direct Debit',
                  `A badge history on every ${MEMBER_NOUN_LOWER} record`,
                ]}
              />
            </div>
          ) : (
            schemes.map((scheme) => (
              <div
                key={scheme.scheme_id}
                className={`bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6 ${
                  scheme.active ? '' : 'opacity-60'
                }`}
              >
                <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-serif text-3xl text-white">{scheme.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-semibold">
                        {SOURCE_LABELS[scheme.source] ?? SOURCE_LABELS.custom}
                      </span>
                      {!scheme.active && (
                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold border border-yellow-500/40">
                          Not in use
                        </span>
                      )}
                    </div>
                    {scheme.description && (
                      <p className="text-text-secondary text-sm mt-3 max-w-2xl">
                        {scheme.description}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedLevel(null);
                          setLevelModalScheme(scheme);
                        }}
                        className="px-4 py-2 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all text-sm"
                      >
                        Add badge
                      </button>
                      <button
                        onClick={() => {
                          setSelectedScheme(scheme);
                          setSchemeModalOpen(true);
                        }}
                        className="px-4 py-2 min-h-[44px] bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteScheme(scheme)}
                        className="px-4 py-2 min-h-[44px] bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all text-sm border border-red-500/40"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {scheme.levels.length === 0 ? (
                  <p className="p-6 text-text-secondary text-sm">
                    This scheme has no badges yet.
                    {canManage ? ' Add one to start assessing against it.' : ''}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-4 px-6 text-sm font-semibold text-white">
                            Badge
                          </th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-white">
                            Badge fee
                          </th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-white">
                            Certificate fee
                          </th>
                          {canManage && (
                            <th className="text-right py-4 px-6 text-sm font-semibold text-white">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {scheme.levels.map((level) => {
                          const badgeFee = feeAmount(level.badge_fee);
                          const certificateFee = feeAmount(level.certificate_fee);
                          return (
                            <tr
                              key={level.level_id}
                              className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                                level.active ? '' : 'opacity-60'
                              }`}
                            >
                              <td className="py-4 px-6">
                                <p className="text-white font-semibold">{level.name}</p>
                                {level.description && (
                                  <p className="text-text-secondary text-sm mt-1">
                                    {level.description}
                                  </p>
                                )}
                              </td>
                              <td className="py-4 px-6 text-text-secondary tabular-nums">
                                {badgeFee === null ? 'Free' : formatCurrency(badgeFee)}
                              </td>
                              <td className="py-4 px-6 text-text-secondary tabular-nums">
                                {certificateFee === null ? 'None' : formatCurrency(certificateFee)}
                              </td>
                              {canManage && (
                                <td className="py-4 px-6">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setSelectedLevel(level);
                                        setLevelModalScheme(scheme);
                                      }}
                                      className="px-3 py-2 min-h-[44px] bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all text-sm"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteLevel(level)}
                                      className="px-3 py-2 min-h-[44px] bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all text-sm border border-red-500/40"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}

          {canManage && schemes.length > 0 && (
            <RiseBridgeCard schemes={schemes} onImported={fetchData} />
          )}

          {canManage && schemes.length > 0 && (
            <button
              onClick={handleInstallDefaults}
              disabled={isSubmitting}
              className="min-h-[48px] px-6 py-3 bg-white text-dark-primary rounded-xl font-semibold border border-grey-200 hover:bg-grey-50 transition-all disabled:opacity-50"
            >
              Add any missing starter schemes
            </button>
          )}
        </div>
      </div>

      <SchemeModal
        isOpen={schemeModalOpen}
        onClose={() => {
          setSchemeModalOpen(false);
          setSelectedScheme(null);
        }}
        onSubmit={handleSchemeSubmit}
        scheme={selectedScheme}
        isLoading={isSubmitting}
      />

      <LevelModal
        isOpen={levelModalScheme !== null}
        onClose={() => {
          setLevelModalScheme(null);
          setSelectedLevel(null);
        }}
        onSubmit={handleLevelSubmit}
        level={selectedLevel}
        schemeName={levelModalScheme?.name ?? ''}
        nextSortOrder={
          levelModalScheme && levelModalScheme.levels.length > 0
            ? Math.max(...levelModalScheme.levels.map((level) => level.sort_order)) + 1
            : 1
        }
        isLoading={isSubmitting}
      />
    </MainLayout>
  );
}
