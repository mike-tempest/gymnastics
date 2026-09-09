'use client';

import { Family } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { isValidPhone, isValidPostalCode } from '@/lib/utils/postal';

const familySchema = z.object({
  family_name: z.string().min(1, 'Family name is required').max(200, 'Family name too long'),
  primary_contact_name: z
    .string()
    .min(1, 'Primary contact name is required')
    .max(200, 'Name too long'),
  primary_contact_email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  primary_contact_phone: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true;
      return isValidPhone(val);
    }, 'Please enter a valid phone number'),
  address_line1: z.string().max(255, 'Address too long').optional(),
  address_line2: z.string().max(255, 'Address too long').optional(),
  city: z.string().max(100, 'City name too long').optional(),
  postcode: z
    .string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true;
      return isValidPostalCode(val);
    }, 'Please enter a valid postcode or ZIP code'),
});

type FamilyFormData = z.infer<typeof familySchema>;

interface FamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: FamilyFormData) => Promise<void>;
  family?: Family | null;
  isLoading?: boolean;
}

export default function FamilyModal({
  isOpen,
  onClose,
  onSubmit,
  family,
  isLoading = false,
}: FamilyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FamilyFormData>({
    resolver: zodResolver(familySchema),
    mode: 'onTouched',
    defaultValues: family
      ? {
          family_name: family.family_name,
          primary_contact_name: family.primary_contact_name,
          primary_contact_email: family.primary_contact_email,
          primary_contact_phone: family.primary_contact_phone || '',
          address_line1: family.address_line1 || '',
          address_line2: family.address_line2 || '',
          city: family.city || '',
          postcode: family.postcode || '',
        }
      : {
          family_name: '',
          primary_contact_name: '',
          primary_contact_email: '',
          primary_contact_phone: '',
          address_line1: '',
          address_line2: '',
          city: '',
          postcode: '',
        },
  });

  // Reset form when family changes or modal opens
  useEffect(() => {
    if (isOpen) {
      reset(
        family
          ? {
              family_name: family.family_name,
              primary_contact_name: family.primary_contact_name,
              primary_contact_email: family.primary_contact_email,
              primary_contact_phone: family.primary_contact_phone || '',
              address_line1: family.address_line1 || '',
              address_line2: family.address_line2 || '',
              city: family.city || '',
              postcode: family.postcode || '',
            }
          : {
              family_name: '',
              primary_contact_name: '',
              primary_contact_email: '',
              primary_contact_phone: '',
              address_line1: '',
              address_line2: '',
              city: '',
              postcode: '',
            }
      );
      // Focus first input after a short delay to ensure modal is rendered
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, family, reset]);

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

  const handleFormSubmit = async (data: FamilyFormData) => {
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
      aria-labelledby="family-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2 id="family-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {family ? 'Edit Family' : 'Add New Family'}
            </h2>
            <p className="text-text-secondary">
              {family
                ? 'Update family information'
                : 'Enter family details to add to your database'}
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
            {/* Family Name */}
            <div>
              <label htmlFor="family_name" className="block text-sm font-semibold text-white mb-2">
                Family Name <span className="text-brand">*</span>
              </label>
              <input
                {...register('family_name')}
                ref={(e) => {
                  register('family_name').ref(e);
                  if (e) {
                    (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                  }
                }}
                id="family_name"
                type="text"
                className={inputCls(!!errors.family_name)}
                placeholder="Enter family name"
                disabled={isSubmitting}
              />
              {errors.family_name && (
                <p className="mt-2 text-sm text-red-400">{errors.family_name.message}</p>
              )}
            </div>

            {/* Primary Contact Name */}
            <div>
              <label
                htmlFor="primary_contact_name"
                className="block text-sm font-semibold text-white mb-2"
              >
                Primary Contact Name <span className="text-brand">*</span>
              </label>
              <input
                {...register('primary_contact_name')}
                id="primary_contact_name"
                type="text"
                autoComplete="name"
                className={inputCls(!!errors.primary_contact_name)}
                placeholder="Enter primary contact name"
                disabled={isSubmitting}
              />
              {errors.primary_contact_name && (
                <p className="mt-2 text-sm text-red-400">{errors.primary_contact_name.message}</p>
              )}
            </div>

            {/* Email and Phone Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="primary_contact_email"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Email <span className="text-brand">*</span>
                </label>
                <input
                  {...register('primary_contact_email')}
                  id="primary_contact_email"
                  type="email"
                  autoComplete="email"
                  className={inputCls(!!errors.primary_contact_email)}
                  placeholder="email@example.com"
                  disabled={isSubmitting}
                />
                {errors.primary_contact_email && (
                  <p className="mt-2 text-sm text-red-400">
                    {errors.primary_contact_email.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="primary_contact_phone"
                  className="block text-sm font-semibold text-white mb-2"
                >
                  Phone <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('primary_contact_phone')}
                  id="primary_contact_phone"
                  type="tel"
                  autoComplete="tel"
                  className={inputCls(!!errors.primary_contact_phone)}
                  placeholder="Phone number"
                  disabled={isSubmitting}
                />
                {errors.primary_contact_phone && (
                  <p className="mt-2 text-sm text-red-400">
                    {errors.primary_contact_phone.message}
                  </p>
                )}
              </div>
            </div>

            {/* Address Line 1 */}
            <div>
              <label
                htmlFor="address_line1"
                className="block text-sm font-semibold text-white mb-2"
              >
                Address Line 1 <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <input
                {...register('address_line1')}
                id="address_line1"
                type="text"
                autoComplete="address-line1"
                className={inputCls(!!errors.address_line1)}
                placeholder="Street address"
                disabled={isSubmitting}
              />
              {errors.address_line1 && (
                <p className="mt-2 text-sm text-red-400">{errors.address_line1.message}</p>
              )}
            </div>

            {/* Address Line 2 */}
            <div>
              <label
                htmlFor="address_line2"
                className="block text-sm font-semibold text-white mb-2"
              >
                Address Line 2 <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <input
                {...register('address_line2')}
                id="address_line2"
                type="text"
                autoComplete="address-line2"
                className={inputCls(!!errors.address_line2)}
                placeholder="Apartment, suite, etc."
                disabled={isSubmitting}
              />
              {errors.address_line2 && (
                <p className="mt-2 text-sm text-red-400">{errors.address_line2.message}</p>
              )}
            </div>

            {/* City and Postcode Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="city" className="block text-sm font-semibold text-white mb-2">
                  City <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('city')}
                  id="city"
                  type="text"
                  autoComplete="address-level2"
                  className={inputCls(!!errors.city)}
                  placeholder="City"
                  disabled={isSubmitting}
                />
                {errors.city && <p className="mt-2 text-sm text-red-400">{errors.city.message}</p>}
              </div>

              <div>
                <label htmlFor="postcode" className="block text-sm font-semibold text-white mb-2">
                  Postcode <span className="text-text-tertiary font-normal">(Optional)</span>
                </label>
                <input
                  {...register('postcode')}
                  id="postcode"
                  type="text"
                  autoComplete="postal-code"
                  className={inputCls(!!errors.postcode)}
                  placeholder="e.g. SW1A 1AA or 90210"
                  disabled={isSubmitting}
                />
                {errors.postcode && (
                  <p className="mt-2 text-sm text-red-400">{errors.postcode.message}</p>
                )}
              </div>
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
                  <span>{family ? 'Updating...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{family ? 'Update Family' : 'Add Family'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
