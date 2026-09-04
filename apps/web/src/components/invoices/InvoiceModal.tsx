'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Family, Swimmer } from '@swim-nexus/shared-types';
import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { getFamilies } from '@/lib/api/families';
import { getSwimmers } from '@/lib/api/swimmers';
import { currencySymbol } from '@/lib/utils/currency';

const invoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(200, 'Description too long'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  unit_price: z.coerce.number().min(0.01, 'Unit price must be greater than 0'),
  type: z.enum(['squad_fee', 'membership', 'gala_entry', 'merchandise', 'other']),
  swimmer_id: z.string().optional().nullable(),
});

const invoiceSchema = z.object({
  family_id: z.string().min(1, 'Family is required'),
  due_date: z.string().min(1, 'Due date is required'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    family_id: string;
    due_date: string;
    items: {
      description: string;
      amount: number;
      type: 'squad_fee' | 'membership' | 'gala_entry' | 'merchandise' | 'other';
      swimmer_id?: string | null;
    }[];
    notes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export default function InvoiceModal({ isOpen, onClose, onSubmit, isLoading = false }: InvoiceModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLSelectElement>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const { country, currency, locale } = useClubRegion();
  const { formatCurrency } = useFormatters();
  const symbol = currencySymbol(currency, locale);
  const galaEntryLabel = country === 'GB' ? 'Gala Entry' : 'Meet Entry';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    watch,
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      family_id: '',
      due_date: '',
      items: [{ description: '', quantity: 1, unit_price: 0, type: 'squad_fee', swimmer_id: null }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const items = watch('items');

  // Calculate totals
  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  };

  // Fetch families and swimmers when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setIsLoadingData(true);
      const [familiesData, swimmersData] = await Promise.all([getFamilies(), getSwimmers()]);
      setFamilies(familiesData);
      setSwimmers(swimmersData);
    } catch {
      // data fetch error - form remains disabled
    } finally {
      setIsLoadingData(false);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        family_id: '',
        due_date: '',
        items: [{ description: '', quantity: 1, unit_price: 0, type: 'squad_fee', swimmer_id: null }],
        notes: '',
      });
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
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

  const handleFormSubmit = async (data: InvoiceFormData) => {
    try {
      // Transform items to include calculated amount
      const transformedItems = data.items.map((item) => ({
        description: item.description,
        amount: Number(item.quantity) * Number(item.unit_price),
        type: item.type,
        swimmer_id: item.swimmer_id || null,
      }));

      await onSubmit({
        family_id: data.family_id,
        due_date: data.due_date,
        items: transformedItems,
        notes: data.notes,
      });
      reset();
    } catch {
      // submission error handled by caller
    }
  };

  if (!isOpen) return null;

  const total = calculateTotal();

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 w-full max-w-[calc(100vw-2rem)] sm:max-w-6xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-8 border-b border-white/10">
          <div>
            <h2 id="invoice-modal-title" className="text-2xl sm:text-3xl font-bold text-white mb-1">Create Invoice</h2>
            <p className="text-text-secondary">Generate a new invoice for a family</p>
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
            {/* Family and Due Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="family_id" className="block text-sm font-semibold text-white mb-2">
                  Family <span className="text-brand">*</span>
                </label>
                <select
                  {...register('family_id')}
                  ref={(e) => {
                    register('family_id').ref(e);
                    if (e) {
                      (firstInputRef as React.MutableRefObject<HTMLSelectElement | null>).current = e;
                    }
                  }}
                  id="family_id"
                  className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                  disabled={isSubmitting || isLoadingData}
                >
                  <option value="">Select a family</option>
                  {families.map((family) => (
                    <option key={family.family_id} value={family.family_id}>
                      {family.family_name} ({family.primary_contact_name})
                    </option>
                  ))}
                </select>
                {errors.family_id && <p className="mt-2 text-sm text-danger">{errors.family_id.message}</p>}
              </div>

              <div>
                <label htmlFor="due_date" className="block text-sm font-semibold text-white mb-2">
                  Due Date <span className="text-brand">*</span>
                </label>
                <input
                  {...register('due_date')}
                  id="due_date"
                  type="date"
                  className="w-full px-4 py-3 bg-white/10 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                  disabled={isSubmitting}
                />
                {errors.due_date && <p className="mt-2 text-sm text-danger">{errors.due_date.message}</p>}
              </div>
            </div>

            {/* Invoice Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-semibold text-white">
                  Invoice Items <span className="text-brand">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ description: '', quantity: 1, unit_price: 0, type: 'squad_fee', swimmer_id: null })}
                  className="px-4 py-2 bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all text-sm"
                  disabled={isSubmitting}
                >
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-white/10 rounded-xl border border-white/10">
                    <div className="flex items-start justify-between mb-4">
                      <h4 className="text-white font-semibold">Item {index + 1}</h4>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          aria-label={`Remove item ${index + 1}`}
                          className="text-danger hover:text-danger/80 transition-colors"
                          disabled={isSubmitting}
                        >
                          <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label htmlFor={`items.${index}.description`} className="block text-sm font-medium text-text-secondary mb-2">
                          Description
                        </label>
                        <input
                          {...register(`items.${index}.description`)}
                          type="text"
                          placeholder="e.g., Monthly Squad Fee - December"
                          className="w-full px-4 py-2 bg-dark-primary/80 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                          disabled={isSubmitting}
                        />
                        {errors.items?.[index]?.description && (
                          <p className="mt-1 text-sm text-danger">{errors.items[index]?.description?.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`items.${index}.type`} className="block text-sm font-medium text-text-secondary mb-2">
                          Type
                        </label>
                        <select
                          {...register(`items.${index}.type`)}
                          className="w-full px-4 py-2 bg-dark-primary/80 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                          disabled={isSubmitting}
                        >
                          <option value="squad_fee">Squad Fee</option>
                          <option value="membership">Membership</option>
                          <option value="gala_entry">{galaEntryLabel}</option>
                          <option value="merchandise">Merchandise</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`items.${index}.swimmer_id`} className="block text-sm font-medium text-text-secondary mb-2">
                          Swimmer (Optional)
                        </label>
                        <select
                          {...register(`items.${index}.swimmer_id`)}
                          className="w-full px-4 py-2 bg-dark-primary/80 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                          disabled={isSubmitting}
                        >
                          <option value="">None</option>
                          {swimmers.map((swimmer) => (
                            <option key={swimmer.swimmer_id} value={swimmer.swimmer_id}>
                              {swimmer.first_name} {swimmer.last_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor={`items.${index}.quantity`} className="block text-sm font-medium text-text-secondary mb-2">
                          Quantity
                        </label>
                        <input
                          {...register(`items.${index}.quantity`)}
                          type="number"
                          min="1"
                          step="1"
                          className="w-full px-4 py-2 bg-dark-primary/80 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                          disabled={isSubmitting}
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="mt-1 text-sm text-danger">{errors.items[index]?.quantity?.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor={`items.${index}.unit_price`} className="block text-sm font-medium text-text-secondary mb-2">
                          Unit Price ({symbol})
                        </label>
                        <input
                          {...register(`items.${index}.unit_price`)}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full px-4 py-2 bg-dark-primary/80 text-white rounded-xl border border-white/10 focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 transition-all outline-none"
                          disabled={isSubmitting}
                        />
                        {errors.items?.[index]?.unit_price && (
                          <p className="mt-1 text-sm text-danger">{errors.items[index]?.unit_price?.message}</p>
                        )}
                      </div>

                      <div className="flex items-end">
                        <div className="w-full">
                          <label className="block text-sm font-medium text-text-secondary mb-2">Total</label>
                          <div className="px-4 py-2 bg-dark-primary/80 text-brand rounded-xl border border-white/10 font-bold text-lg tabular-nums">
                            {formatCurrency((Number(items[index]?.quantity) || 0) * (Number(items[index]?.unit_price) || 0))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {errors.items && typeof errors.items.message === 'string' && (
                <p className="mt-2 text-sm text-danger">{errors.items.message}</p>
              )}
            </div>

            {/* Total Amount Display */}
            <div className="bg-brand/10 border-2 border-brand rounded-xl p-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-semibold text-white">Total Amount:</span>
                <span className="text-4xl font-bold text-brand tabular-nums">{formatCurrency(Number(total))}</span>
              </div>
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
                placeholder="Additional notes or payment instructions..."
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
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Invoice</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
