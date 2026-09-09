'use client';

import {
  Member,
  GOVERNING_BODY_LABELS,
  DISCIPLINE_LABELS,
  DISCIPLINE_SHORT_LABELS,
  ORDERED_DISCIPLINES,
} from '@club-manager/shared-types';
import { Upload, Users } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import DeleteConfirmModal from '@/components/members/DeleteConfirmModal';
import MemberModal, { type MemberSubmitData } from '@/components/members/MemberModal';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useFormatters } from '@/hooks/useFormatters';
import { getMember, createMember, updateMember, deleteMember } from '@/lib/api/members';
import {
  MEMBER_NOUN,
  MEMBER_NOUN_LOWER,
  MEMBER_NOUN_PLURAL,
  MEMBER_NOUN_PLURAL_LOWER,
} from '@/lib/brand';
import { useMembers } from '@/lib/hooks/useMembers';
import { isCoach, useRole } from '@/lib/hooks/useRole';
import { useSquads } from '@/lib/hooks/useSquads';

export default function MembersPage() {
  return (
    <Suspense fallback={null}>
      <MembersPageInner />
    </Suspense>
  );
}

function MembersPageInner() {
  const { formatDate } = useFormatters();
  const { role } = useRole();
  // The importer moved under /admin, which the middleware closes to coaches.
  // They can still see this list, so the link is hidden from them rather than
  // bouncing them onto the dashboard with no explanation.
  const canImport = !isCoach(role);
  const { data: membersData, isLoading, error, refetch: refetchMembers } = useMembers();
  const { data: squadsData } = useSquads();
  const members = useMemo(() => membersData ?? [], [membersData]);
  const squads = squadsData ?? [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [squadFilter, setSquadFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');

  // Delete state
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle ?edit=<member_id> query param (from detail page edit button)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && members.length > 0) {
      const memberToEdit = members.find((s) => s.member_id === editId);
      if (memberToEdit) {
        setSelectedMember(memberToEdit);
        setIsModalOpen(true);
      } else {
        // Member not in list yet - fetch directly
        getMember(editId)
          .then((s) => {
            setSelectedMember(s);
            setIsModalOpen(true);
          })
          .catch(() => {
            // Member not found - ignore
          });
      }
    }
  }, [searchParams, members]);

  // Combined error from hook or mutations
  const displayError = error || mutationError;

  // Filtered members based on search and squad filter
  const filteredMembers = useMemo(() => {
    let result = members;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.first_name.toLowerCase().includes(query) ||
          s.last_name.toLowerCase().includes(query) ||
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(query) ||
          (s.registration_number && s.registration_number.toLowerCase().includes(query))
      );
    }

    if (squadFilter) {
      result = result.filter((s) => s.squad_id === squadFilter);
    }

    if (disciplineFilter) {
      result = result.filter((s) => s.discipline === disciplineFilter);
    }

    return result;
  }, [members, searchQuery, squadFilter, disciplineFilter]);

  const hasFilters = !!searchQuery || !!squadFilter || !!disciplineFilter;

  const clearFilters = () => {
    setSearchQuery('');
    setSquadFilter('');
    setDisciplineFilter('');
  };

  const handleOpenAddModal = () => {
    setSelectedMember(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMember(null);
  };

  const handleSubmit = async (data: MemberSubmitData) => {
    try {
      setIsSubmitting(true);
      setMutationError(null);

      if (selectedMember) {
        await updateMember(selectedMember.member_id, data);
        toast.success(`${MEMBER_NOUN} updated successfully`);
      } else {
        await createMember(data);
        toast.success(`${MEMBER_NOUN} added successfully`);
      }

      refetchMembers();
      handleCloseModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to save ${MEMBER_NOUN_LOWER}`;
      setMutationError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, member: Member) => {
    e.preventDefault();
    e.stopPropagation();
    setMemberToDelete(member);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;
    try {
      setIsDeleting(true);
      await deleteMember(memberToDelete.member_id);
      refetchMembers();
      setMemberToDelete(null);
      toast.success(`${MEMBER_NOUN} removed successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to remove ${MEMBER_NOUN_LOWER}`;
      setMutationError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-2xl sm:text-5xl md:text-6xl text-dark-primary tracking-tight mb-2">
                {MEMBER_NOUN_PLURAL}
              </h1>
              <p className="text-grey-600 text-lg">
                Manage your club&apos;s {MEMBER_NOUN_PLURAL_LOWER}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {canImport && (
                <Link
                  href="/admin/import/members"
                  className="px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-dark-primary/80 text-white rounded-button font-bold hover:bg-white/5 transition-all flex items-center justify-center space-x-3 text-base sm:text-lg border border-white/20"
                >
                  <Upload className="w-6 h-6" />
                  <span>Import CSV</span>
                </Link>
              )}
              <button
                onClick={handleOpenAddModal}
                className="px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
              >
                <span>Add {MEMBER_NOUN}</span>
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
          </div>

          {/* Error Message */}
          {displayError && <ErrorState message={displayError} onRetry={refetchMembers} />}

          {/* Large Stats Card */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">
                  Total {MEMBER_NOUN_PLURAL}
                </p>
                <h2 className="text-4xl sm:text-8xl font-bold text-dark-primary mb-4 tabular-nums">
                  {displayError ? '—' : members.length}
                  {!displayError && <span className="text-4xl">+</span>}
                </h2>
                <p className="text-grey-600 text-lg">
                  {displayError ? 'Unable to load' : `Active ${MEMBER_NOUN_PLURAL}`}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row md:flex-col gap-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">This Month</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold tabular-nums">
                    {displayError ? '—' : members.length}
                  </p>
                </div>
                <div className="bg-surface rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">New This Week</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold tabular-nums">
                    {displayError ? '—' : '0'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <h2 className="font-serif text-2xl sm:text-4xl text-white tracking-tight">
                All {MEMBER_NOUN_PLURAL}
              </h2>
              <div className="flex space-x-2">
                <button className="px-4 py-2 min-h-[44px] bg-brand text-dark-primary rounded-button font-semibold text-sm">
                  Active
                </button>
                <button className="px-4 py-2 min-h-[44px] bg-dark-primary/80 text-grey-300 rounded-button font-semibold text-sm hover:bg-dark-primary">
                  All
                </button>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
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
                  placeholder="Search by name or registration number..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none min-h-[44px]"
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
              <select
                value={squadFilter}
                onChange={(e) => setSquadFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-3 bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none min-h-[44px] sm:min-w-[200px]"
              >
                <option value="">All Squads</option>
                {squads.map((squad) => (
                  <option key={squad.squad_id} value={squad.squad_id}>
                    {squad.squad_name}
                  </option>
                ))}
              </select>
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                aria-label="Filter by discipline"
                className="w-full sm:w-auto px-4 py-3 bg-white/5 text-white rounded-xl border border-white/20 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none min-h-[44px] sm:min-w-[200px]"
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
              <TableSkeleton />
            ) : members.length === 0 ? (
              <EmptyState
                icon={Users}
                title={`No ${MEMBER_NOUN_PLURAL_LOWER} yet`}
                description={`Register your club's ${MEMBER_NOUN_PLURAL_LOWER} so you can track attendance, squads, and progress.`}
                hint="You can also import from a CSV if you have an existing spreadsheet."
                actionLabel={`Add ${MEMBER_NOUN}`}
                actionOnClick={handleOpenAddModal}
              />
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon={Users}
                title={`No ${MEMBER_NOUN_PLURAL_LOWER} found`}
                description={`No ${MEMBER_NOUN_PLURAL_LOWER} match your search criteria`}
                actionLabel="Clear Filters"
                actionOnClick={clearFilters}
              />
            ) : (
              <div className="space-y-4">
                {hasFilters && (
                  <p className="text-text-secondary text-sm mb-2">
                    Showing {filteredMembers.length} of {members.length}{' '}
                    {members.length === 1 ? MEMBER_NOUN_LOWER : MEMBER_NOUN_PLURAL_LOWER}
                  </p>
                )}
                {filteredMembers.map((member, index) => (
                  <Link
                    key={member.member_id}
                    href={`/members/${member.member_id}`}
                    className="flex items-center justify-between p-4 sm:p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-brand transition-all group cursor-pointer min-h-[44px]"
                  >
                    <div className="flex items-center space-x-3 sm:space-x-5 min-w-0">
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-brand rounded-full flex items-center justify-center font-bold text-dark-primary text-lg sm:text-xl shadow-sm">
                          {member.first_name.charAt(0)}
                          {member.last_name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-brand rounded-full border-2 border-dark-secondary flex items-center justify-center text-dark-primary text-xs font-bold">
                          {index + 1}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-base sm:text-xl text-white mb-1 truncate">
                          {member.first_name} {member.last_name}
                        </h3>
                        <p className="text-xs sm:text-sm text-text-secondary line-clamp-2 sm:truncate">
                          Born{' '}
                          {formatDate(member.dob, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}{' '}
                          •
                          {member.gender === 'M'
                            ? ' Male'
                            : member.gender === 'F'
                              ? ' Female'
                              : ' Other'}
                          {member.registration_number &&
                            ` • ${member.governing_body ? `${GOVERNING_BODY_LABELS[member.governing_body]} ` : ''}${member.registration_number}`}
                          {member.discipline && ` • ${DISCIPLINE_SHORT_LABELS[member.discipline]}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-2">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-text-secondary mb-1">Status</p>
                        <span className="px-4 py-1.5 bg-brand bg-opacity-20 text-brand text-sm font-bold rounded-full border border-brand">
                          ACTIVE
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteClick(e, member)}
                        className="p-3 text-text-tertiary hover:bg-red-500 hover:bg-opacity-20 hover:text-red-400 rounded-button transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label={`Remove ${member.first_name} ${member.last_name}`}
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
                          <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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

      {/* Member Modal */}
      <MemberModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        member={selectedMember}
        isLoading={isSubmitting}
      />

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        isOpen={!!memberToDelete}
        onClose={() => setMemberToDelete(null)}
        onConfirm={handleDeleteConfirm}
        memberName={
          memberToDelete ? `${memberToDelete.first_name} ${memberToDelete.last_name}` : ''
        }
        isDeleting={isDeleting}
      />
    </MainLayout>
  );
}
