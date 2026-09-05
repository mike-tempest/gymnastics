'use client';

import { Session, SessionStatus, Squad } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getSquads } from '@/lib/api/squads';

const sessionSchema = z.object({
  session_name: z.string().min(1, 'Session name is required').max(100, 'Session name too long'),
  session_date: z.string().min(1, 'Session date is required'),
  start_time: z.string().min(1, 'Start time is required').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  end_time: z.string().min(1, 'End time is required').regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
  squad_id: z.string().min(1, 'Squad is required'),
  location: z.string().max(200, 'Location too long').optional(),
  description: z.string().optional(),
  coach_name: z.string().max(100, 'Coach name too long').optional(),
  max_participants: z.coerce.number().min(1, 'Max participants must be at least 1').optional().nullable(),
  status: z.nativeEnum(SessionStatus),
}).refine(
  (data) => {
    // Validate that end_time is after start_time
    if (data.start_time && data.end_time) {
      const [startHour, startMin] = data.start_time.split(':').map(Number);
      const [endHour, endMin] = data.end_time.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return endMinutes > startMinutes;
    }
    return true;
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
);

type SessionFormData = z.infer<typeof sessionSchema>;

interface SessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SessionFormData) => Promise<void>;
  session?: Session | null;
  isLoading?: boolean;
}

export default function SessionModal({
  isOpen,
  onClose,
  onSubmit,
  session,
  isLoading = false,
}: SessionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoadingSquads, setIsLoadingSquads] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    mode: 'onTouched',
    defaultValues: session
      ? {
          session_name: session.session_name,
          session_date: session.session_date.split('T')[0], // Extract YYYY-MM-DD
          start_time: session.start_time,
          end_time: session.end_time,
          squad_id: session.squad_id ?? '',
          location: session.location || '',
          description: session.description || '',
          coach_name: session.coach_name || '',
          max_participants: session.max_participants ?? undefined,
          status: session.status,
        }
      : {
          session_name: '',
          session_date: '',
          start_time: '',
          end_time: '',
          squad_id: '',
          location: '',
          description: '',
          coach_name: '',
          max_participants: undefined,
          status: SessionStatus.SCHEDULED,
        },
  });

  // Fetch squads when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSquads();
    }
  }, [isOpen]);

  const fetchSquads = async () => {
    try {
      setIsLoadingSquads(true);
      const data = await getSquads();
      setSquads(data);
    } catch {
      // squad load failed - dropdown will be empty
    } finally {
      setIsLoadingSquads(false);
    }
  };

  // Reset form when session changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset(
        session
          ? {
              session_name: session.session_name,
              session_date: session.session_date.split('T')[0],
              start_time: session.start_time,
              end_time: session.end_time,
              squad_id: session.squad_id ?? '',
              location: session.location || '',
              description: session.description || '',
              coach_name: session.coach_name || '',
              max_participants: session.max_participants ?? undefined,
              status: session.status,
            }
          : {
              session_name: '',
              session_date: '',
              start_time: '',
              end_time: '',
              squad_id: '',
              location: '',
              description: '',
              coach_name: '',
              max_participants: undefined,
              status: SessionStatus.SCHEDULED,
            }
      );
      // Focus first input after a short delay
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, session, reset]);

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

  const handleFormSubmit = async (data: SessionFormData) => {
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
        : 'border-white/20 focus:border-brand focus:ring-brand'
    } focus:ring-2 focus:ring-opacity-50 transition-all outline-none`;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/20 w-full max-w-[calc(100vw-2rem)] sm:max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/20">
          <div>
            <h2 id="session-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {session ? 'Edit Session' : 'Add New Session'}
            </h2>
            <p className="text-text-secondary">
              {session ? 'Update session details' : 'Create a new training session'}
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
            {/* Session Name */}
            <div>
              <label htmlFor="session_name" className="block text-sm font-semibold text-white mb-2">
                Session Name <span className="text-brand">*</span>
              </label>
              <input
                {...register('session_name')}
                ref={(e) => {
                  register('session_name').ref(e);
                  if (e) {
                    (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                  }
                }}
                id="session_name"
                type="text"
                className={inputCls(!!errors.session_name)}
                placeholder="e.g., Monday Training, Sprint Session"
                disabled={isSubmitting}
              />
              {errors.session_name && (
                <p className="mt-2 text-sm text-red-400">{errors.session_name.message}</p>
              )}
            </div>

            {/* Date and Squad Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="session_date" className="block text-sm font-semibold text-white mb-2">
                  Session Date <span className="text-brand">*</span>
                </label>
                <input
                  {...register('session_date')}
                  id="session_date"
                  type="date"
                  className={inputCls(!!errors.session_date)}
                  disabled={isSubmitting}
                />
                {errors.session_date && (
                  <p className="mt-2 text-sm text-red-400">{errors.session_date.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="squad_id" className="block text-sm font-semibold text-white mb-2">
                  Squad <span className="text-brand">*</span>
                </label>
                <select
                  {...register('squad_id')}
                  id="squad_id"
                  className={inputCls(!!errors.squad_id)}
                  disabled={isSubmitting || isLoadingSquads}
                >
                  <option value="">Select a squad</option>
                  {squads.map((squad) => (
                    <option key={squad.squad_id} value={squad.squad_id}>
                      {squad.squad_name}
                    </option>
                  ))}
                </select>
                {errors.squad_id && (
                  <p className="mt-2 text-sm text-red-400">{errors.squad_id.message}</p>
                )}
              </div>
            </div>

            {/* Time Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="start_time" className="block text-sm font-semibold text-white mb-2">
                  Start Time <span className="text-brand">*</span>
                </label>
                <input
                  {...register('start_time')}
                  id="start_time"
                  type="time"
                  className={inputCls(!!errors.start_time)}
                  disabled={isSubmitting}
                />
                {errors.start_time && (
                  <p className="mt-2 text-sm text-red-400">{errors.start_time.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="end_time" className="block text-sm font-semibold text-white mb-2">
                  End Time <span className="text-brand">*</span>
                </label>
                <input
                  {...register('end_time')}
                  id="end_time"
                  type="time"
                  className={inputCls(!!errors.end_time)}
                  disabled={isSubmitting}
                />
                {errors.end_time && (
                  <p className="mt-2 text-sm text-red-400">{errors.end_time.message}</p>
                )}
              </div>
            </div>

            {/* Location and Coach Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="location" className="block text-sm font-semibold text-white mb-2">
                  Location <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('location')}
                  id="location"
                  type="text"
                  className={inputCls(!!errors.location)}
                  placeholder="e.g., Main Pool, Leisure Centre"
                  disabled={isSubmitting}
                />
                {errors.location && (
                  <p className="mt-2 text-sm text-red-400">{errors.location.message}</p>
                )}
              </div>

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
            </div>

            {/* Max Participants and Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="max_participants" className="block text-sm font-semibold text-white mb-2">
                  Max Participants <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('max_participants')}
                  id="max_participants"
                  type="number"
                  min="1"
                  className={inputCls(!!errors.max_participants)}
                  placeholder="20"
                  disabled={isSubmitting}
                />
                {errors.max_participants && (
                  <p className="mt-2 text-sm text-red-400">{errors.max_participants.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-semibold text-white mb-2">
                  Status <span className="text-brand">*</span>
                </label>
                <select
                  {...register('status')}
                  id="status"
                  className={inputCls(!!errors.status)}
                  disabled={isSubmitting}
                >
                  <option value={SessionStatus.SCHEDULED}>Scheduled</option>
                  <option value={SessionStatus.IN_PROGRESS}>In Progress</option>
                  <option value={SessionStatus.COMPLETED}>Completed</option>
                  <option value={SessionStatus.CANCELLED}>Cancelled</option>
                </select>
                {errors.status && (
                  <p className="mt-2 text-sm text-red-400">{errors.status.message}</p>
                )}
              </div>
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
                placeholder="Session details, focus areas, or special notes"
                disabled={isSubmitting}
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 mt-8 pt-6 border-t border-white/20">
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
                  <span>{session ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{session ? 'Update Session' : 'Create Session'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
