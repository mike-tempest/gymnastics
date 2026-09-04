'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FeeStructure } from '@/lib/api/finance';

const termPeriodSchema = z.object({
  billing_period: z
    .string()
    .trim()
    .min(1, 'Please enter a period label, for example "Term 1 2027"')
    .max(20, 'Period label must be 20 characters or fewer'),
});

type TermPeriodFormData = z.infer<typeof termPeriodSchema>;

interface GenerateTermInvoicesModalProps {
  isOpen: boolean;
  feeStructure: FeeStructure | null;
  scopeDescription: string;
  onClose: () => void;
  onSubmit: (billingPeriod: string) => Promise<void>;
}

/**
 * Term fees have no calendar cadence, so before generating invoices the club
 * names the term being billed (for example "Term 1 2027"). The label becomes
 * the billing period key, which keeps re-runs idempotent per term.
 */
export default function GenerateTermInvoicesModal({
  isOpen,
  feeStructure,
  scopeDescription,
  onClose,
  onSubmit,
}: GenerateTermInvoicesModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TermPeriodFormData>({
    resolver: zodResolver(termPeriodSchema),
    mode: 'onTouched',
    defaultValues: { billing_period: '' },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ billing_period: '' });
    }
  }, [isOpen, reset]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isSubmitting, onClose]);

  const handleFormSubmit = async (data: TermPeriodFormData) => {
    await onSubmit(data.billing_period.trim());
  };

  if (!isOpen || !feeStructure) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-term-invoices-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-lg mx-4">
        <div className="p-6 sm:p-8 border-b border-white/10">
          <h2 id="generate-term-invoices-title" className="text-2xl font-bold text-white mb-1">
            Generate Term Invoices
          </h2>
          <p className="text-text-secondary">
            {`"${feeStructure.name}" will be invoiced to ${scopeDescription}. Name the term so the same term is never billed twice.`}
          </p>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 sm:p-8">
          <div>
            <label htmlFor="billing_period" className="block text-sm font-semibold text-white mb-2">
              Term label <span className="text-brand">*</span>
            </label>
            <input
              {...register('billing_period')}
              id="billing_period"
              type="text"
              maxLength={20}
              placeholder="e.g. Term 1 2027"
              className={`w-full px-4 py-3 bg-white/10 text-white rounded-xl border ${
                errors.billing_period
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-white/10 focus:border-brand focus:ring-brand'
              } focus:ring-2 focus:ring-opacity-50 transition-all outline-none`}
              disabled={isSubmitting}
            />
            {errors.billing_period && (
              <p className="mt-2 text-sm text-red-400">{errors.billing_period.message}</p>
            )}
            <p className="mt-2 text-sm text-text-secondary">
              Families already invoiced for this term are skipped automatically.
            </p>
          </div>

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
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3 min-h-[44px] bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Generating...' : 'Generate Invoices'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
