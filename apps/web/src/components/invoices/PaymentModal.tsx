'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PaymentMethod } from '@swim-nexus/shared-types';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import { currencySymbol } from '@/lib/utils/currency';
import { paymentMethodLabel } from '@/lib/utils/region-labels';

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  payment_date: z.string().min(1, 'Payment date is required'),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().max(100, 'Reference too long').optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    method: PaymentMethod;
    reference?: string;
    notes?: string;
  }) => Promise<void>;
  invoiceAmount?: number;
  isLoading?: boolean;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  invoiceAmount = 0,
  isLoading = false,
}: PaymentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { country, currency, locale } = useClubRegion();
  const methodLabel = paymentMethodLabel(country);
  const symbol = currencySymbol(currency, locale);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: invoiceAmount,
      payment_date: getTodayDate(),
      method: PaymentMethod.DIRECT_DEBIT,
      reference: '',
      notes: '',
    },
  });

  // Reset form when modal opens or invoice amount changes
  useEffect(() => {
    if (isOpen) {
      reset({
        amount: invoiceAmount,
        payment_date: getTodayDate(),
        method: PaymentMethod.DIRECT_DEBIT,
        reference: '',
        notes: '',
      });
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, invoiceAmount, reset]);

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

  const handleFormSubmit = async (data: PaymentFormData) => {
    try {
      await onSubmit({
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
      });
      reset();
    } catch {
      // submission error handled by caller
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2 id="payment-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">Record Payment</h2>
            <p className="text-text-secondary">Record a payment received for this invoice</p>
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
            {/* Amount and Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-white mb-2">
                  Amount ({symbol}) <span className="text-brand">*</span>
                </label>
                <input
                  {...register('amount')}
                  ref={(e) => {
                    register('amount').ref(e);
                    if (e) {
                      (firstInputRef as React.MutableRefObject<HTMLInputElement | null>).current = e;
                    }
                  }}
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none tabular-nums"
                  disabled={isSubmitting}
                />
                {errors.amount && <p className="mt-2 text-sm text-danger">{errors.amount.message}</p>}
              </div>

              <div>
                <label htmlFor="payment_date" className="block text-sm font-semibold text-white mb-2">
                  Payment Date <span className="text-brand">*</span>
                </label>
                <input
                  {...register('payment_date')}
                  id="payment_date"
                  type="date"
                  className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                  disabled={isSubmitting}
                />
                {errors.payment_date && <p className="mt-2 text-sm text-danger">{errors.payment_date.message}</p>}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label htmlFor="method" className="block text-sm font-semibold text-white mb-2">
                Payment Method <span className="text-brand">*</span>
              </label>
              <select
                {...register('method')}
                id="method"
                className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                disabled={isSubmitting}
              >
                <option value={PaymentMethod.DIRECT_DEBIT}>{methodLabel}</option>
                <option value={PaymentMethod.CARD}>Card Payment</option>
                <option value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</option>
                <option value={PaymentMethod.CASH}>Cash</option>
                <option value={PaymentMethod.OTHER}>Other</option>
              </select>
              {errors.method && <p className="mt-2 text-sm text-danger">{errors.method.message}</p>}
            </div>

            {/* Reference Number */}
            <div>
              <label htmlFor="reference" className="block text-sm font-semibold text-white mb-2">
                Reference Number <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <input
                {...register('reference')}
                id="reference"
                type="text"
                className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                placeholder="e.g., Transaction ID, cheque number"
                disabled={isSubmitting}
              />
              {errors.reference && <p className="mt-2 text-sm text-danger">{errors.reference.message}</p>}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-semibold text-white mb-2">
                Notes <span className="text-text-tertiary font-normal">(Optional)</span>
              </label>
              <textarea
                {...register('notes')}
                id="notes"
                rows={3}
                className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                placeholder="Additional payment details or notes..."
                disabled={isSubmitting}
              />
              {errors.notes && <p className="mt-2 text-sm text-danger">{errors.notes.message}</p>}
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
                  <span>Recording...</span>
                </>
              ) : (
                <span>Record Payment</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
