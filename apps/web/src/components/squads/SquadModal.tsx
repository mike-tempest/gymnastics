'use client';

import { Squad, Swimmer } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { assignSwimmerToSquad, removeSwimmerFromSquad } from '@/lib/api/squads';
import { getSwimmers } from '@/lib/api/swimmers';

const squadSchema = z.object({
  squad_name: z.string().min(1, 'Squad name is required').max(100, 'Squad name too long'),
  description: z.string().optional(),
  min_age: z.coerce.number().min(0, 'Min age must be at least 0').max(100, 'Invalid age').optional().nullable(),
  max_age: z.coerce.number().min(0, 'Max age must be at least 0').max(100, 'Invalid age').optional().nullable(),
  coach_name: z.string().max(100, 'Coach name too long').optional(),
  training_times: z.string().optional(),
  max_capacity: z.coerce.number().min(1, 'Capacity must be at least 1').optional().nullable(),
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

interface SquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SquadFormData) => Promise<void>;
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
  const [allSwimmers, setAllSwimmers] = useState<Swimmer[]>([]);
  const [squadSwimmers, setSquadSwimmers] = useState<Swimmer[]>([]);
  const [isLoadingSwimmers, setIsLoadingSwimmers] = useState(false);
  const [showSwimmerManagement, setShowSwimmerManagement] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SquadFormData>({
    resolver: zodResolver(squadSchema),
    mode: 'onTouched',
    defaultValues: squad
      ? {
          squad_name: squad.squad_name,
          description: squad.description || '',
          min_age: squad.min_age ?? undefined,
          max_age: squad.max_age ?? undefined,
          coach_name: squad.coach_name || '',
          training_times: squad.training_times || '',
          max_capacity: squad.max_capacity ?? undefined,
        }
      : {
          squad_name: '',
          description: '',
          min_age: undefined,
          max_age: undefined,
          coach_name: '',
          training_times: '',
          max_capacity: undefined,
        },
  });

  // Fetch swimmers when editing an existing squad
  useEffect(() => {
    if (isOpen && squad) {
      setShowSwimmerManagement(true);
      const loadSwimmers = async () => {
        try {
          setIsLoadingSwimmers(true);
          const swimmers = await getSwimmers();
          setAllSwimmers(swimmers);
          setSquadSwimmers(squad.swimmers || []);
        } catch {
          // swimmer load failed - assignment panel will be empty
        } finally {
          setIsLoadingSwimmers(false);
        }
      };
      loadSwimmers();
    } else {
      setShowSwimmerManagement(false);
    }
  }, [isOpen, squad]);

  const handleAddSwimmer = async (swimmerId: string) => {
    if (!squad) return;

    try {
      await assignSwimmerToSquad(squad.squad_id, swimmerId);
      const swimmer = allSwimmers.find(s => s.swimmer_id === swimmerId);
      if (swimmer) {
        setSquadSwimmers([...squadSwimmers, swimmer]);
      }
    } catch {
      // add swimmer failed silently
    }
  };

  const handleRemoveSwimmer = async (swimmerId: string) => {
    if (!squad) return;

    try {
      await removeSwimmerFromSquad(squad.squad_id, swimmerId);
      setSquadSwimmers(squadSwimmers.filter(s => s.swimmer_id !== swimmerId));
    } catch {
      // remove swimmer failed silently
    }
  };

  // Reset form when squad changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset(
        squad
          ? {
              squad_name: squad.squad_name,
              description: squad.description || '',
              min_age: squad.min_age ?? undefined,
              max_age: squad.max_age ?? undefined,
              coach_name: squad.coach_name || '',
              training_times: squad.training_times || '',
              max_capacity: squad.max_capacity ?? undefined,
            }
          : {
              squad_name: '',
              description: '',
              min_age: undefined,
              max_age: undefined,
              coach_name: '',
              training_times: '',
              max_capacity: undefined,
            }
      );
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
    try {
      await onSubmit(data);
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

  const availableSwimmers = allSwimmers.filter(
    swimmer => !squadSwimmers.some(s => s.swimmer_id === swimmer.swimmer_id)
  );

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

            {/* Swimmer Management (only for existing squads) */}
            {showSwimmerManagement && squad && (
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">Squad Members</h3>

                {isLoadingSwimmers ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin h-8 w-8 border-4 border-brand border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Members */}
                    <div>
                      <h4 className="text-sm font-semibold text-text-secondary mb-3">
                        Current Members ({squadSwimmers.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {squadSwimmers.length === 0 ? (
                          <p className="text-text-secondary text-sm py-4 text-center">No members yet</p>
                        ) : (
                          squadSwimmers.map((swimmer) => (
                            <div
                              key={swimmer.swimmer_id}
                              className="flex items-center justify-between p-3 bg-dark-primary/80 rounded-xl"
                            >
                              <span className="text-white text-sm">
                                {swimmer.first_name} {swimmer.last_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSwimmer(swimmer.swimmer_id)}
                                className="text-red-400 hover:text-red-300 text-sm font-semibold"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Available Swimmers */}
                    <div>
                      <h4 className="text-sm font-semibold text-text-secondary mb-3">
                        Available Swimmers ({availableSwimmers.length})
                      </h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {availableSwimmers.length === 0 ? (
                          <p className="text-text-secondary text-sm py-4 text-center">
                            All swimmers assigned
                          </p>
                        ) : (
                          availableSwimmers.map((swimmer) => (
                            <div
                              key={swimmer.swimmer_id}
                              className="flex items-center justify-between p-3 bg-dark-primary/80 rounded-xl"
                            >
                              <span className="text-white text-sm">
                                {swimmer.first_name} {swimmer.last_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddSwimmer(swimmer.swimmer_id)}
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
