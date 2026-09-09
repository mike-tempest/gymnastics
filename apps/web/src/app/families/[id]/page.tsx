'use client';

import { Member } from '@club-manager/shared-types';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import DeleteConfirmModal from '@/components/families/DeleteConfirmModal';
import FamilyModal from '@/components/families/FamilyModal';
import InviteLinkModal from '@/components/families/InviteLinkModal';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { useFormatters } from '@/hooks/useFormatters';
import { updateFamily, deleteFamily, generateInvite, CreateFamilyData } from '@/lib/api/families';
import { getMembersByFamily } from '@/lib/api/members';
import { MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { useFamily } from '@/lib/hooks';

export default function FamilyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { formatDate } = useFormatters();
  const {
    data: family,
    isLoading,
    error: familyError,
    refetch: refetchFamily,
  } = useFamily(params.id);
  const [members, setMembers] = useState<Member[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  useEffect(() => {
    if (params.id) {
      getMembersByFamily(params.id)
        .then(setMembers)
        .catch(() => {});
    }
  }, [params.id]);

  const fetchFamilyData = async () => {
    refetchFamily();
    try {
      const familyMembers = await getMembersByFamily(params.id);
      setMembers(familyMembers);
    } catch {
      // Members fetch failed - not critical
    }
  };

  const handleOpenEditModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (data: CreateFamilyData) => {
    if (!family) return;

    try {
      setIsSubmitting(true);
      setError(null);

      await updateFamily(family.family_id, data);
      await fetchFamilyData();
      handleCloseModal();
      toast.success('Family updated successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update family';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!family) return;

    try {
      setIsDeleting(true);
      await deleteFamily(family.family_id);
      toast.success('Family deleted successfully');
      router.push('/families');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete family';
      setError(message);
      toast.error(message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!family) return;

    try {
      setIsGeneratingInvite(true);
      setError(null);
      const result = await generateInvite(family.family_id);
      setInviteUrl(result.inviteUrl);
      setShowInviteModal(true);
      toast.success('Invitation link generated');
      await fetchFamilyData(); // Refresh to show updated invite status
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate invitation link';
      setError(message);
      toast.error(message);
    } finally {
      setIsGeneratingInvite(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-16">
              <div className="inline-block animate-spin h-12 w-12 border-4 border-brand border-t-transparent rounded-full"></div>
              <p className="text-grey-500 text-lg mt-4">Loading family details...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!family) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-16">
              <p className="text-grey-500 text-lg">Family not found</p>
              <button
                onClick={() => router.push('/families')}
                className="mt-4 px-6 py-3 bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all"
              >
                Back to Families
              </button>
            </div>
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
              { label: 'Families', href: '/families' },
              { label: family.family_name || 'Family Details' },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">
                {family.family_name}
              </h1>
              <p className="text-grey-500 text-lg">
                {family.primary_contact_name} • {family.primary_contact_email}
              </p>
              {/* Invite Status Badge */}
              <div className="mt-3">
                {family.invite_status === 'accepted' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-500 bg-opacity-20 text-green-400 border border-green-500">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                    Invitation Accepted
                  </span>
                )}
                {family.invite_status === 'pending' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-500 bg-opacity-20 text-yellow-400 border border-yellow-500">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Invitation Pending
                  </span>
                )}
                {!family.invite_status && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-text-tertiary bg-opacity-20 text-text-tertiary border border-text-tertiary">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Not Invited
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleGenerateInvite}
                disabled={isGeneratingInvite}
                className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg disabled:opacity-50"
              >
                {isGeneratingInvite ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Invite Parent</span>
                  </>
                )}
              </button>
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
                <span>Edit Family</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting || isDeleting}
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
                <span>Delete Family</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {(error || familyError) && (
            <div className="mb-6 p-4 bg-red-500 bg-opacity-10 border border-red-500 rounded-xl">
              <p className="text-red-400 font-semibold">{error || familyError}</p>
            </div>
          )}

          {/* Family Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Primary Contact */}
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
                <span className="text-text-secondary text-sm font-semibold">Primary Contact</span>
              </div>
              <p className="text-white text-xl font-bold">{family.primary_contact_name}</p>
            </div>

            {/* Email */}
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
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <span className="text-text-secondary text-sm font-semibold">Email</span>
              </div>
              <p className="text-white text-lg break-all">{family.primary_contact_email}</p>
            </div>

            {/* Phone */}
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
                  <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                <span className="text-text-secondary text-sm font-semibold">Phone</span>
              </div>
              <p className="text-white text-lg">{family.primary_contact_phone || 'Not provided'}</p>
            </div>
          </div>

          {/* Address */}
          {(family.address_line1 || family.address_line2 || family.city || family.postcode) && (
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
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <h2 className="font-serif text-2xl text-dark-primary">Address</h2>
              </div>
              <div className="text-grey-500 text-lg space-y-1">
                {family.address_line1 && <p>{family.address_line1}</p>}
                {family.address_line2 && <p>{family.address_line2}</p>}
                {(family.city || family.postcode) && (
                  <p>{[family.city, family.postcode].filter(Boolean).join(', ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-8 border border-white/10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-4xl text-dark-primary tracking-tight">
                Family Members
              </h2>
              <span className="text-grey-500 text-lg">
                {members.length}{' '}
                {members.length === 1 ? MEMBER_NOUN_LOWER : MEMBER_NOUN_PLURAL_LOWER}
              </span>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-16">
                <svg
                  className="w-20 h-20 text-text-tertiary mx-auto mb-4"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                <p className="text-grey-500 text-lg">
                  No {MEMBER_NOUN_PLURAL_LOWER} in this family yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {members.map((member) => (
                  <div
                    key={member.member_id}
                    className="p-6 bg-white/5 rounded-2xl hover:border-brand transition-all group cursor-pointer"
                    onClick={() => router.push(`/members/${member.member_id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-white mb-1">
                          {member.first_name} {member.last_name}
                        </h3>
                        {member.dob && (
                          <p className="text-sm text-text-secondary">
                            Born:{' '}
                            {formatDate(member.dob, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })}
                          </p>
                        )}
                        {member.registration_number && (
                          <p className="text-xs text-text-tertiary mt-1">
                            Reg: {member.registration_number}
                          </p>
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <FamilyModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        family={family}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        familyName={family.family_name}
        isDeleting={isDeleting}
      />

      {/* Invite Link Modal */}
      <InviteLinkModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        inviteUrl={inviteUrl}
        familyName={family.family_name}
      />
    </MainLayout>
  );
}
