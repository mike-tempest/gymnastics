'use client';

import {
  Swimmer,
  Squad,
  GoverningBody,
  GOVERNING_BODY_LABELS,
  COUNTRY_GOVERNING_BODIES,
  governingBodyConfig,
} from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import { getSquads } from '@/lib/api/squads';

const swimmerSchema = z
  .object({
    first_name: z.string().min(1, 'Please enter a first name').max(100, 'First name must be under 100 characters'),
    last_name: z.string().min(1, 'Please enter a last name').max(100, 'Last name must be under 100 characters'),
    dob: z.string().min(1, 'Please select a date of birth').refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      return date <= new Date();
    }, 'Date of birth cannot be in the future'),
    gender: z.enum(['M', 'F', 'X'], { errorMap: () => ({ message: 'Please select a gender' }) }),
    governing_body: z.nativeEnum(GoverningBody).or(z.literal('')).optional(),
    se_number: z.string().max(20, 'Registration number must be under 20 characters').optional().or(z.literal('')),
    squad_id: z.string().min(1, 'Please select a squad'),
    medical_notes: z.string().max(2000, 'Medical notes must be under 2000 characters').optional().or(z.literal('')),
    emergency_contact: z.string().max(200, 'Emergency contact must be under 200 characters').optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    // A registration number and its governing body must be provided together.
    if (data.se_number && !data.governing_body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['governing_body'],
        message: 'Select the governing body for this registration number',
      });
    }
    if (data.governing_body && !data.se_number) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['se_number'],
        message: 'Enter the registration number',
      });
    }
  });

type SwimmerFormData = z.infer<typeof swimmerSchema>;

// What the modal hands back to its parent. Blank registration fields are
// normalised to null so they are stored as NULL rather than empty strings.
export interface SwimmerSubmitData {
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  governing_body?: string | null;
  se_number?: string | null;
  squad_id?: string;
  medical_notes?: string;
  emergency_contact?: string;
}

interface SwimmerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SwimmerSubmitData) => Promise<void>;
  swimmer?: Swimmer | null;
  isLoading?: boolean;
}

export default function SwimmerModal({
  isOpen,
  onClose,
  onSubmit,
  swimmer,
  isLoading = false,
}: SwimmerModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadsLoading, setSquadsLoading] = useState(false);
  const { country } = useClubRegion();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SwimmerFormData>({
    resolver: zodResolver(swimmerSchema),
    mode: 'onTouched',
    defaultValues: swimmer
      ? {
          first_name: swimmer.first_name,
          last_name: swimmer.last_name,
          dob: swimmer.dob.split('T')[0],
          gender: swimmer.gender as 'M' | 'F' | 'X',
          governing_body: swimmer.governing_body || '',
          se_number: swimmer.se_number || '',
          squad_id: swimmer.squad_id || '',
          medical_notes: swimmer.medical_notes || '',
          emergency_contact: swimmer.emergency_contact || '',
        }
      : {
          first_name: '',
          last_name: '',
          dob: '',
          gender: undefined,
          governing_body: '',
          se_number: '',
          squad_id: '',
          medical_notes: '',
          emergency_contact: '',
        },
  });

  // Fetch squads when modal opens
  useEffect(() => {
    if (isOpen) {
      setSquadsLoading(true);
      getSquads()
        .then(setSquads)
        .catch(() => { /* squad load failed - dropdown will be empty */ })
        .finally(() => setSquadsLoading(false));
    }
  }, [isOpen]);

  // Reset form when swimmer changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset(
        swimmer
          ? {
              first_name: swimmer.first_name,
              last_name: swimmer.last_name,
              dob: swimmer.dob.split('T')[0],
              gender: swimmer.gender as 'M' | 'F' | 'X',
              governing_body: swimmer.governing_body || '',
              se_number: swimmer.se_number || '',
              squad_id: swimmer.squad_id || '',
              medical_notes: swimmer.medical_notes || '',
              emergency_contact: swimmer.emergency_contact || '',
            }
          : {
              first_name: '',
              last_name: '',
              dob: '',
              gender: undefined,
              governing_body: '',
              se_number: '',
              squad_id: '',
              medical_notes: '',
              emergency_contact: '',
            }
      );
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, swimmer, reset]);

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

  const handleFormSubmit = async (data: SwimmerFormData) => {
    const payload: SwimmerSubmitData = {
      ...data,
      se_number: data.se_number ? data.se_number : null,
      governing_body: data.governing_body ? data.governing_body : null,
    };
    try {
      await onSubmit(payload);
      reset();
    } catch {
      // submission error handled by caller
    }
  };

  if (!isOpen) return null;

  const inputClassName = (hasError?: boolean) =>
    `w-full px-4 py-3 bg-white/10 text-white rounded-xl border ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
        : 'border-white/10 focus:border-brand focus:ring-brand'
    } focus:ring-2 focus:ring-opacity-50 transition-all outline-none`;

  // Only offer the governing bodies available in the club's country. Falls back
  // to the GB bodies for unknown countries, matching the useClubRegion default.
  // Uppercase the code to match the ISO alpha-2 keys of COUNTRY_GOVERNING_BODIES.
  const availableGoverningBodies =
    COUNTRY_GOVERNING_BODIES[country.toUpperCase()] ?? COUNTRY_GOVERNING_BODIES.GB;

  // Label the registration number with the selected body's term (e.g. "SE
  // number", "USA Swimming ID"). With no body chosen, keep the generic default.
  const selectedGoverningBody = watch('governing_body');
  const registrationNumberLabel = selectedGoverningBody
    ? governingBodyConfig(selectedGoverningBody).registrationNumberLabel
    : 'Registration Number';

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="swimmer-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-2xl border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2 id="swimmer-modal-title" className="font-serif text-2xl sm:text-3xl text-white mb-1">
              {swimmer ? 'Edit Swimmer' : 'Add New Swimmer'}
            </h2>
            <p className="text-white/70">
              {swimmer ? 'Update swimmer information' : 'Enter swimmer details to add to your roster'}
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
            {/* First Name and Last Name Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="first_name" className="block text-sm font-semibold text-white mb-2">
                  First Name <span className="text-brand">*</span>
                </label>
                <input
                  {...register('first_name')}
                  ref={(e) => {
                    register('first_name').ref(e);
                    firstInputRef.current = e;
                  }}
                  id="first_name"
                  type="text"
                  className={inputClassName(!!errors.first_name)}
                  placeholder="Enter first name"
                  disabled={isSubmitting}
                />
                {errors.first_name && (
                  <p className="mt-2 text-sm text-red-400">{errors.first_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="last_name" className="block text-sm font-semibold text-white mb-2">
                  Last Name <span className="text-brand">*</span>
                </label>
                <input
                  {...register('last_name')}
                  id="last_name"
                  type="text"
                  className={inputClassName(!!errors.last_name)}
                  placeholder="Enter last name"
                  disabled={isSubmitting}
                />
                {errors.last_name && (
                  <p className="mt-2 text-sm text-red-400">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Date of Birth and Gender Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="dob" className="block text-sm font-semibold text-white mb-2">
                  Date of Birth <span className="text-brand">*</span>
                </label>
                <input
                  {...register('dob')}
                  id="dob"
                  type="date"
                  className={inputClassName(!!errors.dob)}
                  disabled={isSubmitting}
                />
                {errors.dob && <p className="mt-2 text-sm text-red-400">{errors.dob.message}</p>}
              </div>

              <div>
                <label htmlFor="gender" className="block text-sm font-semibold text-white mb-2">
                  Gender <span className="text-brand">*</span>
                </label>
                <select
                  {...register('gender')}
                  id="gender"
                  className={inputClassName(!!errors.gender)}
                  disabled={isSubmitting}
                >
                  <option value="">Select gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="X">Other</option>
                </select>
                {errors.gender && (
                  <p className="mt-2 text-sm text-red-400">{errors.gender.message}</p>
                )}
              </div>
            </div>

            {/* Governing Body and Registration Number Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="governing_body" className="block text-sm font-semibold text-white mb-2">
                  Governing Body{' '}
                  <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <select
                  {...register('governing_body')}
                  id="governing_body"
                  className={inputClassName(!!errors.governing_body)}
                  disabled={isSubmitting}
                >
                  <option value="">Select governing body</option>
                  {availableGoverningBodies.map((body) => (
                    <option key={body} value={body}>
                      {GOVERNING_BODY_LABELS[body]}
                    </option>
                  ))}
                </select>
                {errors.governing_body && (
                  <p className="mt-2 text-sm text-red-400">{errors.governing_body.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="se_number" className="block text-sm font-semibold text-white mb-2">
                  {registrationNumberLabel}{' '}
                  <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('se_number')}
                  id="se_number"
                  type="text"
                  className={inputClassName(!!errors.se_number)}
                  placeholder="e.g. 1234567"
                  disabled={isSubmitting}
                />
                {errors.se_number && (
                  <p className="mt-2 text-sm text-red-400">{errors.se_number.message}</p>
                )}
              </div>
            </div>

            {/* Squad */}
            <div>
              <label htmlFor="squad_id" className="block text-sm font-semibold text-white mb-2">
                Squad <span className="text-brand">*</span>
              </label>
              <select
                {...register('squad_id')}
                id="squad_id"
                className={inputClassName(!!errors.squad_id)}
                disabled={isSubmitting || squadsLoading}
              >
                <option value="">
                  {squadsLoading ? 'Loading squads...' : 'Select a squad'}
                </option>
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

            {/* Emergency Contact */}
            <div>
              <label htmlFor="emergency_contact" className="block text-sm font-semibold text-white mb-2">
                Emergency Contact{' '}
                <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <input
                {...register('emergency_contact')}
                id="emergency_contact"
                type="text"
                className={inputClassName(!!errors.emergency_contact)}
                placeholder="e.g. Jane Smith - 07700 900000"
                disabled={isSubmitting}
              />
              {errors.emergency_contact && (
                <p className="mt-2 text-sm text-red-400">{errors.emergency_contact.message}</p>
              )}
            </div>

            {/* Medical Notes */}
            <div>
              <label htmlFor="medical_notes" className="block text-sm font-semibold text-white mb-2">
                Medical Notes{' '}
                <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <textarea
                {...register('medical_notes')}
                id="medical_notes"
                rows={3}
                className={`${inputClassName(!!errors.medical_notes)} resize-none`}
                placeholder="Any medical conditions, allergies, or other notes the coaching team should be aware of"
                disabled={isSubmitting}
              />
              {errors.medical_notes && (
                <p className="mt-2 text-sm text-red-400">{errors.medical_notes.message}</p>
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
                  <span>{swimmer ? 'Updating...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{swimmer ? 'Update Swimmer' : 'Add Swimmer'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
