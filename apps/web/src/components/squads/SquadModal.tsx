'use client';

import {
  Squad,
  Member,
  Discipline,
  DISCIPLINE_LABELS,
  ORDERED_DISCIPLINES,
  ProgrammeFlag,
  PROGRAMME_FLAG_LABELS,
  SquadType,
  SQUAD_TYPE_LABELS,
} from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getMembers } from '@/lib/api/members';
import { assignMemberToSquad, removeMemberFromSquad } from '@/lib/api/squads';
import { MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

const squadSchema = z.object({
  squad_name: z.string().min(1, 'Squad name is required').max(100, 'Squad name too long'),
  description: z.string().optional(),
  min_age: z.coerce.number().min(0, 'Min age must be at least 0').max(100, 'Invalid age').optional().nullable(),
  max_age: z.coerce.number().min(0, 'Max age must be at least 0').max(100, 'Invalid age').optional().nullable(),
  coach_name: z.string().max(100, 'Coach name too long').optional(),
  training_times: z.string().optional(),
  max_capacity: z.coerce.number().min(1, 'Capacity must be at least 1').optional().nullable(),
  // Empty string is the "nothing selected" value of a native select; it is
  // normalised to null on submit so the column stores NULL, not ''.
  squad_type: z.nativeEnum(SquadType).or(z.literal('')).optional(),
  level: z.string().max(100, 'Level too long').optional().or(z.literal('')),
  discipline: z.nativeEnum(Discipline).or(z.literal('')).optional(),
  programme_flags: z.array(z.nativeEnum(ProgrammeFlag)).optional(),
}).refine(
  (data) => {
    if (data.min_age !== undefined && data.min_age !== null &&
        data.max_age !== undefined && data.max_age !== null) {
      return data.min_age <= data.max_age;
    }
    return true;
  },
  {
    message: 'Minimum age cannot be greater than maximum age',
    path: ['min_age'],
  }
);

type SquadFormData = z.infer<typeof squadSchema>;

// What the modal hands back to its parent. The select fields are normalised
// from empty string to null so they are stored as NULL rather than ''.
export interface SquadSubmitData {
  squad_name: string;
  description?: string;
  min_age?: number | null;
  max_age?: number | null;
  coach_name?: string;
  training_times?: string;
  max_capacity?: number | null;
  squad_type?: SquadType | null;
  level?: string | null;
  discipline?: Discipline | null;
  programme_flags?: ProgrammeFlag[] | null;
}

/**
 * Form values for a squad, or the blank form when adding one. Kept in one
 * place because the modal seeds the form here and again on every open.
 */
function toFormValues(squad?: Squad | null): SquadFormData {
  return {
    squad_name: squad?.squad_name ?? '',
    description: squad?.description || '',
    min_age: squad?.min_age ?? undefined,
    max_age: squad?.max_age ?? undefined,
    coach_name: squad?.coach_name || '',
    training_times: squad?.training_times || '',
    max_capacity: squad?.max_capacity ?? undefined,
    squad_type: squad?.squad_type || '',
    level: squad?.level || '',
    discipline: squad?.discipline || '',
    programme_flags: squad?.programme_flags ?? [],
  };
}

interface SquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SquadSubmitData) => Promise<void>;
  squad?: Squad | null;
  isLoading?: boolean;
}

export default function SquadModal({
  isOpen,
  onClose,
  onSubmit,
  squad,
  isLoading = false,
}: SquadModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [squadMembers, setSquadMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SquadFormData>({
    resolver: zodResolver(squadSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(squad),
  });

  // Fetch members when editing an existing squad
  useEffect(() => {
    if (isOpen && squad) {
      setShowMemberManagement(true);
      const loadMembers = async () => {
        try {
          setIsLoadingMembers(true);
          const members = await getMembers();
          setAllMembers(members);
          setSquadMembers(squad.members || []);
        } catch {
          // member load failed - assignment panel will be empty
        } finally {
          setIsLoadingMembers(false);
        }
      };
      loadMembers();
    } else {
      setShowMemberManagement(false);
    }
  }, [isOpen, squad]);

  const handleAddMember = async (memberId: string) => {
    if (!squad) return;

    try {
      await assignMemberToSquad(squad.squad_id, memberId);
      const member = allMembers.find(s => s.member_id === memberId);
      if (member) {
        setSquadMembers([...squadMembers, member]);
      }
    } catch {
      // add member failed silently
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!squad) return;

    try {
      await removeMemberFromSquad(squad.squad_id, memberId);
      setSquadMembers(squadMembers.filter(s => s.member_id !== memberId));
    } catch {
      // remove member failed silently
    }
  };

  // Reset form when squad changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset(toFormValues(squad));
      // Focus first input after a short delay to ensure modal is rendered
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, squad, reset]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isSubmitting, onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current && !isSubmitting) {
      onClose();
    }
  };

  const handleFormSubmit = async (data: SquadFormData) => {
    const payload: SquadSubmitData = {
      ...data,
      squad_type: data.squad_type ? data.squad_type : null,
      level: data.level ? data.level : null,
      discipline: data.discipline ? data.discipline : null,
      programme_flags: data.programme_flags?.length ? data.programme_flags : null,
    };
    try {
      await onSubmit(payload);
      reset();
    } catch {
      // submission error handled by caller
    }
  };

  if (!isOpen) return null;

  const inputCls = (hasError?: boolean) =>
    `w-full px-4 py-3 bg-white/10 text-white rounded-xl border ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
        : 'border-white/10 focus:border-brand focus:ring-brand'
    } focus:ring-2 focus:ring-opacity-50 transition-all outline-none`;

  const availableMembers = allMembers.filter(
    member => !squadMembers.some(s => s.member_id === member.member_id)
  );

  // A level is a recreational idea: it names where a class sits in a badge
  // pathway. Competitive squads have grades and age groups instead. Clubs
  // still label things their own way, so this only warns.
  const selectedSquadType = watch('squad_type');
  const enteredLevel = watch('level');
  const showLevelMismatchWarning =
    !!enteredLevel && !!selectedSquadType && selectedSquadType !== SquadType.RECREATIONAL;
  const isRecreational = selectedSquadType === SquadType.RECREATIONAL;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="squad-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2 id="squad-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {squad ? 'Edit Squad' : 'Add New Squad'}
            </h2>
            <p className="text-text-secondary">
              {squad ? 'Update squad information and manage members' : 'Enter squad details to create a new training group'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-white/10 rounded-xl transition-all disabled:opacity-50"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6 text-text-secondary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 sm:p-8">
          <div className="space-y-6">
            {/* Squad Name */}
            <div>
              <label htmlFor="squad_name" className="block text-sm font-semibold text-white mb-2">
                Squad Name <span className="text-brand">*</span>
              </label>
              <input
                {...register('squad_name')}
                ref={(e) => {
                  register('squad_name').ref(e);
                  if (e) {
                    (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                  }
                }}
                id="squad_name"
                type="text"
                className={inputCls(!!errors.squad_name)}
                placeholder="e.g., Development Squad, Age Group, Senior Elite"
                disabled={isSubmitting}
              />
              {errors.squad_name && (
                <p className="mt-2 text-sm text-red-400">{errors.squad_name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-white mb-2">
                Description <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <textarea
                {...register('description')}
                id="description"
                rows={3}
                className={inputCls(!!errors.description)}
                placeholder="Describe the squad's focus, level, or goals"
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>
              )}
            </div>

            {/* Squad Type and Discipline Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="squad_type" className="block text-sm font-semibold text-white mb-2">
                  Squad Type <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <select
                  {...register('squad_type')}
                  id="squad_type"
                  className={inputCls(!!errors.squad_type)}
                  disabled={isSubmitting}
                >
                  <option value="">Not set</option>
                  {Object.values(SquadType).map((type) => (
                    <option key={type} value={type}>
                      {SQUAD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                {errors.squad_type && (
                  <p className="mt-2 text-sm text-red-400">{errors.squad_type.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="discipline" className="block text-sm font-semibold text-white mb-2">
                  Discipline <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <select
                  {...register('discipline')}
                  id="discipline"
                  className={inputCls(!!errors.discipline)}
                  disabled={isSubmitting}
                >
                  <option value="">All disciplines</option>
                  {ORDERED_DISCIPLINES.map((discipline) => (
                    <option key={discipline} value={discipline}>
                      {DISCIPLINE_LABELS[discipline]}
                    </option>
                  ))}
                </select>
                {errors.discipline && (
                  <p className="mt-2 text-sm text-red-400">{errors.discipline.message}</p>
                )}
              </div>
            </div>

            {/* Level: a recreational idea, so it appears for recreational
                squads. It also stays visible whenever a level has already been
                entered, so an existing value never becomes uneditable. */}
            {(isRecreational || !!enteredLevel) && (
              <div>
                <label htmlFor="level" className="block text-sm font-semibold text-white mb-2">
                  Level <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('level')}
                  id="level"
                  type="text"
                  className={inputCls(!!errors.level)}
                  placeholder="e.g. Rise Explore, Badge 4, Bronze"
                  disabled={isSubmitting}
                />
                <p className="mt-2 text-sm text-text-tertiary">
                  Use your club&apos;s own wording. Rise stages and club badge levels both work.
                </p>
                {showLevelMismatchWarning && (
                  <p className="mt-2 text-sm text-amber-400">
                    Levels usually describe recreational classes. This squad is marked{' '}
                    {SQUAD_TYPE_LABELS[SquadType.COMPETITIVE].toLowerCase()}, so check that is what
                    you meant. You can still save it.
                  </p>
                )}
                {errors.level && (
                  <p className="mt-2 text-sm text-red-400">{errors.level.message}</p>
                )}
              </div>
            )}

            {/* Programme Flags */}
            <fieldset>
              <legend className="block text-sm font-semibold text-white mb-2">
                Programmes <span className="text-text-tertiary font-normal">(Optional)</span>
              </legend>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                {Object.values(ProgrammeFlag).map((flag) => (
                  <label
                    key={flag}
                    htmlFor={`programme_flag_${flag}`}
                    className="flex items-center gap-3 px-4 py-3 min-h-[48px] bg-white/10 border border-white/10 rounded-xl text-white cursor-pointer hover:border-brand transition-all"
                  >
                    <input
                      {...register('programme_flags')}
                      id={`programme_flag_${flag}`}
                      type="checkbox"
                      value={flag}
                      className="w-5 h-5 accent-brand"
                      disabled={isSubmitting}
                    />
                    <span className="text-sm font-semibold">{PROGRAMME_FLAG_LABELS[flag]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-sm text-text-tertiary">
                Who the sessions are for. A squad can serve more than one programme.
              </p>
              {errors.programme_flags && (
                <p className="mt-2 text-sm text-red-400">{errors.programme_flags.message}</p>
              )}
            </fieldset>

            {/* Age Range and Capacity Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="min_age" className="block text-sm font-semibold text-white mb-2">
                  Min Age <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('min_age')}
                  id="min_age"
                  type="number"
                  min="0"
                  max="100"
                  className={inputCls(!!errors.min_age)}
                  placeholder="0"
                  disabled={isSubmitting}
                />
                {errors.min_age && (
                  <p className="mt-2 text-sm text-red-400">{errors.min_age.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="max_age" className="block text-sm font-semibold text-white mb-2">
                  Max Age <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('max_age')}
                  id="max_age"
                  type="number"
                  min="0"
                  max="100"
                  className={inputCls(!!errors.max_age)}
                  placeholder="99"
                  disabled={isSubmitting}
                />
                {errors.max_age && (
                  <p className="mt-2 text-sm text-red-400">{errors.max_age.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="max_capacity" className="block text-sm font-semibold text-white mb-2">
                  Max Capacity <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('max_capacity')}
                  id="max_capacity"
                  type="number"
                  min="1"
                  className={inputCls(!!errors.max_capacity)}
                  placeholder="20"
                  disabled={isSubmitting}
                />
                {errors.max_capacity && (
                  <p className="mt-2 text-sm text-red-400">{errors.max_capacity.message}</p>
                )}
              </div>
            </div>

            {/* Coach Name */}
            <div>
              <label htmlFor="coach_name" className="block text-sm font-semibold text-white mb-2">
                Coach Name <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <input
                {...register('coach_name')}
                id="coach_name"
                type="text"
                className={inputCls(!!errors.coach_name)}
                placeholder="e.g., John Smith"
                disabled={isSubmitting}
              />
              {errors.coach_name && (
                <p className="mt-2 text-sm text-red-400">{errors.coach_name.message}</p>
              )}
            </div>

            {/* Training Times */}
            <div>
              <label htmlFor="training_times" className="block text-sm font-semibold text-white mb-2">
                Training Times <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <textarea
                {...register('training_times')}
                id="training_times"
                rows={2}
                className={inputCls(!!errors.training_times)}
                placeholder="e.g., Mon/Wed/Fri 6-7pm, Sat 9-11am"
                disabled={isSubmitting}
              />
              {errors.training_times && (
                <p className="mt-2 text-sm text-red-400">{errors.training_times.message}</p>
              )}
            </div>

            {/* Member Management (only for existing squads) */}
            {showMemberManagement && squad && (
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">Squad {MEMBER_NOUN_PLURAL}</h3>

                {isLoadingMembers ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin h-8 w-8 border-4 border-brand border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current squad members */}
                    <div>
                      <h4 className="text-sm font-semibold text-text-secondary mb-3">
                        Current {MEMBER_NOUN_PLURAL} ({squadMembers.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {squadMembers.length === 0 ? (
                          <p className="text-text-secondary text-sm py-4 text-center">No {MEMBER_NOUN_PLURAL_LOWER} yet</p>
                        ) : (
                          squadMembers.map((member) => (
                            <div
                              key={member.member_id}
                              className="flex items-center justify-between p-3 bg-dark-primary/80 rounded-xl"
                            >
                              <span className="text-white text-sm">
                                {member.first_name} {member.last_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member.member_id)}
                                className="text-red-400 hover:text-red-300 text-sm font-semibold"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Available members */}
                    <div>
                      <h4 className="text-sm font-semibold text-text-secondary mb-3">
                        Available {MEMBER_NOUN_PLURAL} ({availableMembers.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {availableMembers.length === 0 ? (
                          <p className="text-text-secondary text-sm py-4 text-center">
                            All {MEMBER_NOUN_PLURAL_LOWER} assigned
                          </p>
                        ) : (
                          availableMembers.map((member) => (
                            <div
                              key={member.member_id}
                              className="flex items-center justify-between p-3 bg-dark-primary/80 rounded-xl"
                            >
                              <span className="text-white text-sm">
                                {member.first_name} {member.last_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddMember(member.member_id)}
                                className="text-brand hover:text-brand-light text-sm font-semibold"
                              >
                                Add
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-8 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-3 min-h-[44px] bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full sm:w-auto px-8 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSubmitting || isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    aria-hidden="true"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>{squad ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{squad ? 'Update Squad' : 'Create Squad'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
