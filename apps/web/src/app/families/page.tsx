'use client';

import { Family } from '@club-manager/shared-types';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import FamilyModal from '@/components/families/FamilyModal';
import MainLayout from '@/components/layout/MainLayout';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/skeleton';
import { getFamily, createFamily, updateFamily, CreateFamilyData } from '@/lib/api/families';
import { MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { useFamilies } from '@/lib/hooks';

export default function FamiliesPage() {
  return (
    <Suspense fallback={null}>
      <FamiliesPageInner />
    </Suspense>
  );
}

function FamiliesPageInner() {
  const { data: familiesData, isLoading: loading, error, refetch: loadFamilies } = useFamilies();
  const families = useMemo(() => familiesData || [], [familiesData]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Handle ?edit=<family_id> query param
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && families.length > 0) {
      const familyToEdit = families.find((f) => f.family_id === editId);
      if (familyToEdit) {
        setSelectedFamily(familyToEdit);
        setIsModalOpen(true);
      } else {
        // Family not in list yet - fetch directly
        getFamily(editId)
          .then((f) => {
            setSelectedFamily(f);
            setIsModalOpen(true);
          })
          .catch(() => {
            // Family not found - ignore
          });
      }
    }
  }, [searchParams, families]);

  // Filtered families based on search query
  const filteredFamilies = useMemo(() => {
    if (!searchQuery.trim()) {
      return families;
    }

    const query = searchQuery.toLowerCase().trim();
    return families.filter(
      (f) =>
        f.family_name.toLowerCase().includes(query) ||
        f.primary_contact_name.toLowerCase().includes(query) ||
        f.primary_contact_email.toLowerCase().includes(query) ||
        (f.primary_contact_phone && f.primary_contact_phone.toLowerCase().includes(query))
    );
  }, [families, searchQuery]);

  const handleOpenAddModal = () => {
    setSelectedFamily(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFamily(null);
  };

  const handleSubmit = async (data: CreateFamilyData) => {
    try {
      setIsSubmitting(true);
      if (selectedFamily) {
        // Update existing family
        await updateFamily(selectedFamily.family_id, data);
        toast.success('Family updated successfully');
      } else {
        // Create new family
        await createFamily(data);
        toast.success('Family added successfully');
      }
      // Reload families list
      await loadFamilies();
      handleCloseModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save family');
      throw err; // Re-throw to let modal handle the error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">Families</h1>
              <p className="text-grey-600 text-lg">Manage family accounts and contacts</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
            >
              <span>Add Family</span>
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

          {/* Error State */}
          {error && <ErrorState message={error} onRetry={loadFamilies} />}

          {/* Large Stats Card */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">Total Families</p>
                <h2 className="text-5xl sm:text-8xl font-bold text-dark-primary mb-4">
                  {error ? '—' : families.length}
                  {!error && <span className="text-4xl">+</span>}
                </h2>
                <p className="text-grey-600 text-lg">{error ? 'Unable to load' : 'Active Families'}</p>
              </div>
              <div className="flex flex-row sm:flex-col gap-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">{`Total ${MEMBER_NOUN_PLURAL}`}</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold">
                    {error ? '—' : families.reduce((sum, family) => sum + (family.members?.length || 0), 0)}
                  </p>
                </div>
                <div className="bg-white rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Avg per Family</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold">
                    {error ? '—' : families.length > 0
                      ? (
                          Math.round(
                            (families.reduce(
                              (sum, family) => sum + (family.members?.length || 0),
                              0
                            ) /
                              families.length) *
                              10
                          ) / 10
                        )
                      : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Families List */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <h2 className="font-serif text-2xl sm:text-4xl text-white tracking-tight">All Families</h2>
              <div className="flex space-x-2">
                <button className="px-4 py-2 min-h-[44px] bg-brand text-dark-primary rounded-button font-semibold text-sm">
                  Active
                </button>
                <button className="px-4 py-2 min-h-[44px] bg-dark-primary/80 text-grey-300 rounded-button font-semibold text-sm hover:bg-dark-primary">
                  All
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none min-h-[44px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <TableSkeleton />
            ) : families.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No families yet"
                description={`Families link parents to their ${MEMBER_NOUN_PLURAL_LOWER} for billing and communications.`}
                hint="When parents register, their family is created automatically."
                actionLabel="Add Family"
                actionHref="/families/new"
              />
            ) : filteredFamilies.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No families found"
                description="No families match your search criteria"
                actionLabel="Clear Search"
                actionOnClick={() => setSearchQuery('')}
              />
            ) : (
              <div className="space-y-4">
                {searchQuery && (
                  <p className="text-text-secondary text-sm mb-2">
                    Showing {filteredFamilies.length} of {families.length} {families.length === 1 ? 'family' : 'families'}
                  </p>
                )}
                {filteredFamilies.map((family, index) => (
                  <Link
                    key={family.family_id}
                    href={`/families/${family.family_id}`}
                    className="flex items-center justify-between p-4 sm:p-6 bg-white/5 rounded-2xl hover:border-brand transition-all group cursor-pointer min-h-[44px]"
                  >
                    <div className="flex items-center space-x-3 sm:space-x-5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-brand rounded-full flex items-center justify-center font-bold text-dark-primary text-lg sm:text-xl shadow-sm">
                          {family.family_name
                            .split(' ')
                            .map((word) => word.charAt(0))
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-brand rounded-full border-2 border-dark-secondary flex items-center justify-center text-dark-primary text-xs font-bold">
                          {index + 1}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-xl text-white mb-1 truncate">{family.family_name}</h3>
                        <p className="text-xs sm:text-sm text-text-secondary line-clamp-2 sm:truncate">
                          {family.primary_contact_name} • {family.primary_contact_email}
                          {family.primary_contact_phone && ` • ${family.primary_contact_phone}`}
                        </p>
                        {(family.city || family.postcode) && (
                          <p className="text-xs text-text-secondary mt-1 truncate">
                            {[family.city, family.postcode].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-2">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-text-secondary mb-1">{MEMBER_NOUN_PLURAL}</p>
                        <span className="px-4 py-1.5 bg-brand bg-opacity-20 text-brand text-sm font-bold rounded-full border border-brand whitespace-nowrap">
                          {family.members?.length || 0} MEMBERS
                        </span>
                      </div>
                      <div className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-brand hover:text-dark-primary rounded-button transition-all group-hover:bg-brand group-hover:text-dark-primary">
                        <svg
                          className="w-6 h-6"
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
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Family Modal */}
      <FamilyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        family={selectedFamily}
        isLoading={isSubmitting}
      />
    </MainLayout>
  );
}
