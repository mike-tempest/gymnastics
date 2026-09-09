'use client';

import {
  Competition,
  CompetitionType,
  CompetitionStatus,
  Course,
  QualifyingTime,
} from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import {
  competitionTypeLabels,
  formatSwimTime,
  parseSwimTimeInput,
} from '@/lib/competitions-utils';

const QT_STROKES = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'];
const QT_DISTANCES = [25, 50, 100, 200, 400, 800, 1500];

const competitionSchema = z.object({
  name: z.string().min(1, 'Competition name is required').max(255, 'Name too long'),
  organiser: z.string().max(255, 'Organiser name too long').optional().or(z.literal('')),
  venue: z.string().max(255, 'Venue name too long').optional().or(z.literal('')),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional().or(z.literal('')),
  type: z.nativeEnum(CompetitionType),
  course: z.nativeEnum(Course),
  status: z.nativeEnum(CompetitionStatus),
  entry_deadline: z.string().optional().or(z.literal('')),
  qualifying_times: z
    .array(
      z.object({
        distance: z.coerce.number(),
        stroke: z.string().min(1),
        time: z
          .string()
          .min(1, 'Time is required')
          .refine(
            (value) => parseSwimTimeInput(value) !== null,
            'Use a time like 32.50 or 1:05.23'
          ),
      })
    )
    .optional(),
});

type CompetitionFormData = z.infer<typeof competitionSchema>;

/** Form data with qualifying times parsed from display strings to seconds. */
export type CompetitionSubmitData = Omit<CompetitionFormData, 'qualifying_times'> & {
  qualifying_times?: QualifyingTime[];
};

function qualifyingTimesToForm(competition?: Competition | null) {
  return (
    competition?.qualifying_times?.map((qt) => ({
      distance: qt.distance,
      stroke: qt.stroke,
      time: formatSwimTime(qt.time).replace(/^00:/, '').replace(/^0/, ''),
    })) ?? []
  );
}

interface CompetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CompetitionSubmitData) => Promise<void>;
  competition?: Competition | null;
  isLoading?: boolean;
}

export default function CompetitionModal({
  isOpen,
  onClose,
  onSubmit,
  competition,
  isLoading = false,
}: CompetitionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { country } = useClubRegion();
  const typeLabels = competitionTypeLabels(country);
  const isAU = country === 'AU';
  const namePlaceholder = isAU
    ? 'e.g. State Age Championships 2026'
    : 'e.g. County Championships 2026';
  const organiserPlaceholder = isAU ? 'e.g. Swimming NSW' : 'e.g. County ASA';

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CompetitionFormData>({
    resolver: zodResolver(competitionSchema),
    mode: 'onTouched',
    defaultValues: competition
      ? {
          name: competition.name,
          organiser: competition.organiser || '',
          venue: competition.venue || '',
          start_date: competition.start_date ? competition.start_date.slice(0, 10) : '',
          end_date: competition.end_date ? competition.end_date.slice(0, 10) : '',
          type: competition.type,
          course: competition.course,
          status: competition.status,
          entry_deadline: competition.entry_deadline ? competition.entry_deadline.slice(0, 10) : '',
          qualifying_times: qualifyingTimesToForm(competition),
        }
      : {
          name: '',
          organiser: '',
          venue: '',
          start_date: '',
          end_date: '',
          type: CompetitionType.OPEN_MEET,
          course: Course.SHORT_COURSE,
          status: CompetitionStatus.DRAFT,
          entry_deadline: '',
          qualifying_times: [],
        },
  });

  const {
    fields: qualifyingFields,
    append: appendQualifying,
    remove: removeQualifying,
  } = useFieldArray({ control, name: 'qualifying_times' });

  useEffect(() => {
    if (isOpen) {
      reset(
        competition
          ? {
              name: competition.name,
              organiser: competition.organiser || '',
              venue: competition.venue || '',
              start_date: competition.start_date ? competition.start_date.slice(0, 10) : '',
              end_date: competition.end_date ? competition.end_date.slice(0, 10) : '',
              type: competition.type,
              course: competition.course,
              status: competition.status,
              entry_deadline: competition.entry_deadline
                ? competition.entry_deadline.slice(0, 10)
                : '',
              qualifying_times: qualifyingTimesToForm(competition),
            }
          : {
              name: '',
              organiser: '',
              venue: '',
              start_date: '',
              end_date: '',
              type: CompetitionType.OPEN_MEET,
              course: Course.SHORT_COURSE,
              status: CompetitionStatus.DRAFT,
              entry_deadline: '',
              qualifying_times: [],
            }
      );
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, competition, reset]);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current && !isSubmitting) {
      onClose();
    }
  };

  const handleFormSubmit = async (data: CompetitionFormData) => {
    try {
      // Qualifying times are typed as display strings; the API takes seconds.
      const { qualifying_times, ...rest } = data;
      await onSubmit({
        ...rest,
        qualifying_times: qualifying_times?.map((qt) => ({
          distance: qt.distance,
          stroke: qt.stroke,
          time: parseSwimTimeInput(qt.time) ?? 0,
        })),
      });
      reset();
    } catch {
      // submission error handled by caller
    }
  };

  if (!isOpen) return null;

  const fieldCls = (hasError?: boolean, isSelect?: boolean) =>
    `w-full px-4 py-3 bg-white/10 text-white rounded-xl border ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
        : 'border-white/10 focus:border-brand focus:ring-brand'
    } focus:ring-2 focus:ring-opacity-50 transition-all outline-none${isSelect ? ' appearance-none' : ''}`;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="competition-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2
              id="competition-modal-title"
              className="text-2xl sm:text-3xl font-bold text-white mb-1"
            >
              {competition ? 'Edit Competition' : 'Add New Competition'}
            </h2>
            <p className="text-text-secondary">
              {competition ? 'Update competition details' : 'Enter competition details'}
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
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 sm:p-8">
          <div className="space-y-6">
            {/* Competition Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                Competition Name <span className="text-brand">*</span>
              </label>
              <input
                {...register('name')}
                ref={(e) => {
                  register('name').ref(e);
                  if (e) {
                    (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                  }
                }}
                id="name"
                type="text"
                className={fieldCls(!!errors.name)}
                placeholder={namePlaceholder}
                disabled={isSubmitting}
              />
              {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
            </div>

            {/* Type and Course */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="type" className="block text-sm font-semibold text-white mb-2">
                  Type
                </label>
                <select
                  {...register('type')}
                  id="type"
                  className={fieldCls(!!errors.type, true)}
                  disabled={isSubmitting}
                >
                  {(
                    [
                      CompetitionType.OPEN_MEET,
                      CompetitionType.CLUB_GALA,
                      CompetitionType.TIME_TRIAL,
                      CompetitionType.COUNTY,
                      CompetitionType.REGIONAL,
                      CompetitionType.NATIONAL,
                    ] as const
                  ).map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </select>
                {errors.type && <p className="mt-2 text-sm text-red-400">{errors.type.message}</p>}
              </div>

              <div>
                <label htmlFor="course" className="block text-sm font-semibold text-white mb-2">
                  Course
                </label>
                <select
                  {...register('course')}
                  id="course"
                  className={fieldCls(!!errors.course, true)}
                  disabled={isSubmitting}
                >
                  <option value={Course.SHORT_COURSE}>Short Course (25m)</option>
                  <option value={Course.LONG_COURSE}>Long Course (50m)</option>
                </select>
                {errors.course && (
                  <p className="mt-2 text-sm text-red-400">{errors.course.message}</p>
                )}
              </div>
            </div>

            {/* Organiser and Venue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="organiser" className="block text-sm font-semibold text-white mb-2">
                  Organiser <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('organiser')}
                  id="organiser"
                  type="text"
                  className={fieldCls(!!errors.organiser)}
                  placeholder={organiserPlaceholder}
                  disabled={isSubmitting}
                />
                {errors.organiser && (
                  <p className="mt-2 text-sm text-red-400">{errors.organiser.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="venue" className="block text-sm font-semibold text-white mb-2">
                  Venue <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('venue')}
                  id="venue"
                  type="text"
                  className={fieldCls(!!errors.venue)}
                  placeholder="e.g. London Aquatics Centre"
                  disabled={isSubmitting}
                />
                {errors.venue && (
                  <p className="mt-2 text-sm text-red-400">{errors.venue.message}</p>
                )}
              </div>
            </div>

            {/* Start and End Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="start_date" className="block text-sm font-semibold text-white mb-2">
                  Start Date <span className="text-brand">*</span>
                </label>
                <input
                  {...register('start_date')}
                  id="start_date"
                  type="date"
                  className={fieldCls(!!errors.start_date)}
                  disabled={isSubmitting}
                />
                {errors.start_date && (
                  <p className="mt-2 text-sm text-red-400">{errors.start_date.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="end_date" className="block text-sm font-semibold text-white mb-2">
                  End Date <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('end_date')}
                  id="end_date"
                  type="date"
                  className={fieldCls(!!errors.end_date)}
                  disabled={isSubmitting}
                />
                {errors.end_date && (
                  <p className="mt-2 text-sm text-red-400">{errors.end_date.message}</p>
                )}
              </div>
            </div>

            {/* Entry Deadline and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="entry_deadline"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Entry Deadline <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('entry_deadline')}
                  id="entry_deadline"
                  type="date"
                  className={fieldCls(!!errors.entry_deadline)}
                  disabled={isSubmitting}
                />
                {errors.entry_deadline && (
                  <p className="mt-2 text-sm text-red-400">{errors.entry_deadline.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-semibold text-white mb-2">
                  Status
                </label>
                <select
                  {...register('status')}
                  id="status"
                  className={fieldCls(!!errors.status, true)}
                  disabled={isSubmitting}
                >
                  <option value={CompetitionStatus.DRAFT}>Draft</option>
                  <option value={CompetitionStatus.OPEN}>Open</option>
                  <option value={CompetitionStatus.CLOSED}>Closed</option>
                  <option value={CompetitionStatus.RESULTS_PUBLISHED}>Results Published</option>
                </select>
                {errors.status && (
                  <p className="mt-2 text-sm text-red-400">{errors.status.message}</p>
                )}
              </div>
            </div>

            {/* Qualifying Times */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-white">
                  Qualifying Times{' '}
                  <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => appendQualifying({ distance: 100, stroke: 'Freestyle', time: '' })}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-3 py-2 min-h-[44px] text-sm text-brand hover:bg-white/5 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" /> Add standard
                </button>
              </div>
              {qualifyingFields.length === 0 ? (
                <p className="text-text-tertiary text-sm">
                  Add consideration times to flag which entries qualify for each event.
                </p>
              ) : (
                <div className="space-y-2">
                  {qualifyingFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start"
                    >
                      <select
                        {...register(`qualifying_times.${index}.distance`)}
                        className={fieldCls(false, true)}
                        disabled={isSubmitting}
                        aria-label="Distance"
                      >
                        {QT_DISTANCES.map((d) => (
                          <option key={d} value={d}>
                            {d}m
                          </option>
                        ))}
                      </select>
                      <select
                        {...register(`qualifying_times.${index}.stroke`)}
                        className={fieldCls(false, true)}
                        disabled={isSubmitting}
                        aria-label="Stroke"
                      >
                        {QT_STROKES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <div>
                        <input
                          {...register(`qualifying_times.${index}.time`)}
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 1:05.23"
                          className={fieldCls(!!errors.qualifying_times?.[index]?.time)}
                          disabled={isSubmitting}
                          aria-label="Qualifying time"
                        />
                        {errors.qualifying_times?.[index]?.time && (
                          <p className="mt-1 text-xs text-red-400">
                            {errors.qualifying_times[index]?.time?.message}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQualifying(index)}
                        disabled={isSubmitting}
                        className="p-3 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 rounded-xl transition-all"
                        aria-label={`Remove qualifying time ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  <span>{competition ? 'Updating...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{competition ? 'Update Competition' : 'Add Competition'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
