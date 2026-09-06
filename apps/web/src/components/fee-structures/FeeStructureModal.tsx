'use client';

import { Squad } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import { FeeStructure } from '@/lib/api/finance';
import { getSquads } from '@/lib/api/squads';
import { MEMBER_NOUN } from '@/lib/brand';
import { currencySymbol } from '@/lib/utils/currency';

const feeStructureSchema = z.object({
  name: z.string().min(1, 'Please enter a name for this fee structure').max(100, 'Fee name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional(),
  amount: z.coerce.number()
    .min(0.01, 'Please enter an amount greater than zero')
    .max(10000, 'Amount cannot exceed 10,000. Please check the value entered.'),
  frequency: z.enum(['monthly', 'term', 'annual', 'one_time']),
  applies_to: z.enum(['club', 'squad', 'member']),
  squad_id: z.string().optional().nullable(),
  is_active: z.boolean(),
}).refine(
  (data) => {
    if (data.applies_to === 'squad' && !data.squad_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Please select a squad for this fee to apply to',
    path: ['squad_id'],
  }
);

type FeeStructureFormData = z.infer<typeof feeStructureSchema>;

interface FeeStructureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FeeStructureFormData) => Promise<void>;
  feeStructure?: FeeStructure | null;
  isLoading?: boolean;
}

export default function FeeStructureModal({
  isOpen,
  onClose,
  onSubmit,
  feeStructure,
  isLoading = false,
}: FeeStructureModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoadingSquads, setIsLoadingSquads] = useState(false);
  const { currency, locale } = useClubRegion();
  const symbol = currencySymbol(currency, locale);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FeeStructureFormData>({
    resolver: zodResolver(feeStructureSchema),
    mode: 'onTouched',
    defaultValues: feeStructure
      ? {
          name: feeStructure.name,
          description: feeStructure.description || '',
          amount: feeStructure.amount,
          frequency: feeStructure.frequency,
          applies_to: feeStructure.applies_to,
          squad_id: feeStructure.squad_id || '',
          is_active: feeStructure.is_active,
        }
      : {
          name: '',
          description: '',
          amount: 0,
          frequency: 'monthly' as const,
          applies_to: 'club' as const,
          squad_id: '',
          is_active: true,
        },
  });

  const appliesTo = watch('applies_to');

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

  // Reset form when modal opens or feeStructure changes
  useEffect(() => {
    if (isOpen) {
      reset(
        feeStructure
          ? {
              name: feeStructure.name,
              description: feeStructure.description || '',
              amount: feeStructure.amount,
              frequency: feeStructure.frequency,
              applies_to: feeStructure.applies_to,
              squad_id: feeStructure.squad_id || '',
              is_active: feeStructure.is_active,
            }
          : {
              name: '',
              description: '',
              amount: 0,
              frequency: 'monthly' as const,
              applies_to: 'club' as const,
              squad_id: '',
              is_active: true,
            }
      );
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, feeStructure, reset]);

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

  const handleFormSubmit = async (data: FeeStructureFormData) => {
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

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fee-structure-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2 id="fee-structure-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {feeStructure ? 'Edit Fee Structure' : 'Create Fee Structure'}
            </h2>
            <p className="text-text-secondary">
              {feeStructure ? 'Update fee structure details' : 'Create a new fee structure for billing'}
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
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-white mb-2">
                Fee Name <span className="text-brand">*</span>
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
                className={inputCls(!!errors.name)}
                placeholder="e.g., Monthly Squad Fee, Annual Membership"
                disabled={isSubmitting}
              />
              {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
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
                placeholder="Describe what this fee covers..."
                disabled={isSubmitting}
              />
              {errors.description && <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>}
            </div>

            {/* Amount and Frequency Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-white mb-2">
                  Amount ({symbol}) <span className="text-brand">*</span>
                </label>
                <input
                  {...register('amount')}
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputCls(!!errors.amount)}
                  disabled={isSubmitting}
                />
                {errors.amount && <p className="mt-2 text-sm text-red-400">{errors.amount.message}</p>}
              </div>

              <div>
                <label htmlFor="frequency" className="block text-sm font-semibold text-white mb-2">
                  Frequency <span className="text-brand">*</span>
                </label>
                <select
                  {...register('frequency')}
                  id="frequency"
                  className={inputCls(!!errors.frequency)}
                  disabled={isSubmitting}
                >
                  <option value="monthly">Monthly</option>
                  <option value="term">Per term</option>
                  <option value="annual">Annual</option>
                  <option value="one_time">One-time</option>
                </select>
                {errors.frequency && <p className="mt-2 text-sm text-red-400">{errors.frequency.message}</p>}
              </div>
            </div>

            {/* Applies To and Squad Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="applies_to" className="block text-sm font-semibold text-white mb-2">
                  Applies To <span className="text-brand">*</span>
                </label>
                <select
                  {...register('applies_to')}
                  id="applies_to"
                  className={inputCls(!!errors.applies_to)}
                  disabled={isSubmitting}
                >
                  <option value="club">Whole Club</option>
                  <option value="squad">Specific Squad</option>
                  <option value="member">Per {MEMBER_NOUN}</option>
                </select>
                {errors.applies_to && <p className="mt-2 text-sm text-red-400">{errors.applies_to.message}</p>}
              </div>

              {appliesTo === 'squad' && (
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
                  {errors.squad_id && <p className="mt-2 text-sm text-red-400">{errors.squad_id.message}</p>}
                </div>
              )}
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-3 p-4 bg-white/10 rounded-xl border border-white/10">
              <input
                {...register('is_active')}
                id="is_active"
                type="checkbox"
                className="w-5 h-5 bg-dark-primary/80 border-2 border-white/10 rounded focus:ring-2 focus:ring-brand text-brand"
                disabled={isSubmitting}
              />
              <label htmlFor="is_active" className="text-white font-medium cursor-pointer">
                Active (fee will be applied to new invoices)
              </label>
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
                  <span>{feeStructure ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{feeStructure ? 'Update Fee Structure' : 'Create Fee Structure'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
