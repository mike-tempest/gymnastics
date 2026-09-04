'use client';

import { Family } from '@swim-nexus/shared-types';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useConfirm } from '@/hooks/useConfirm';
import { useFormatters } from '@/hooks/useFormatters';
import { getFamilies } from '@/lib/api/families';
import { createInvoice } from '@/lib/api/finance';
import { currencySymbol } from '@/lib/utils/currency';

type LineItemType = 'squad_fee' | 'membership' | 'gala_entry' | 'merchandise' | 'other';

interface LineItem {
  id: string;
  description: string;
  amount: string;
  type: LineItemType;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export default function CreateBillingInvoicePage() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const { formatCurrency } = useFormatters();
  const { country, currency, locale } = useClubRegion();
  const symbol = currencySymbol(currency, locale);
  const galaEntryLabel = country === 'GB' ? 'Gala Entry' : 'Meet Entry';

  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [familyId, setFamilyId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { id: generateId(), description: '', amount: '', type: 'squad_fee' },
  ]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ family?: string; dueDate?: string; items?: string }>({});

  useEffect(() => {
    fetchFamilies();
  }, []);

  useEffect(() => {
    // Track unsaved changes
    const hasData = !!(familyId || dueDate || notes || items.some(i => i.description || i.amount));
    setHasUnsavedChanges(hasData);
  }, [familyId, dueDate, notes, items]);

  useEffect(() => {
    // Warn before leaving with unsaved changes
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSubmitting]);

  const fetchFamilies = async () => {
    try {
      setIsLoadingData(true);
      const data = await getFamilies();
      setFamilies(data);
    } catch (err) {
      setError('Failed to load families. Please try again.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const addItem = () => {
    setItems((prev) => [...prev, { id: generateId(), description: '', amount: '', type: 'squad_fee' }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const total = items.reduce((sum, item) => {
    const amount = parseFloat(item.amount) || 0;
    return sum + amount;
  }, 0);

  const validate = (): string | null => {
    const errors: typeof fieldErrors = {};
    
    if (!familyId) errors.family = 'Please select a family.';
    if (!dueDate) {
      errors.dueDate = 'Please set a due date.';
    } else {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) {
        errors.dueDate = 'Due date is in the past.';
      }
    }
    
    const validItems = items.filter((item) => item.description.trim() && parseFloat(item.amount) > 0);
    if (validItems.length === 0) {
      errors.items = 'Please add at least one line item with a description and amount.';
    }
    
    setFieldErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      return Object.values(errors)[0];
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const invoiceItems = items
        .filter((item) => item.description.trim() && parseFloat(item.amount) > 0)
        .map((item) => ({
          description: item.description.trim(),
          amount: parseFloat(item.amount),
          type: item.type,
        }));

      const result = await createInvoice({
        family_id: familyId,
        due_date: dueDate,
        items: invoiceItems,
        notes: notes.trim() || undefined,
      });

      toast.success('Invoice created successfully');
      router.push(`/billing/${result.invoice_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invoice';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Billing', href: '/billing' },
              { label: 'Create Invoice' },
            ]}
          />

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl md:text-5xl text-dark-primary tracking-tight mb-1">Create Invoice</h1>
            <p className="text-dark-primary/60">Generate a new invoice for a family</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl">
              <p className="text-red-400 font-semibold">{error}</p>
            </div>
          )}

          {isLoadingData ? (
            <LoadingSpinner message="Loading families..." size="md" />
          ) : (
            <div className="space-y-6">
              {/* Family & Due Date */}
              <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">Invoice Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="family" className="block text-sm font-semibold text-white mb-2">
                      Family <span className="text-brand">*</span>
                    </label>
                    {families.length === 0 ? (
                      <div className="w-full px-4 py-3 bg-dark-primary/50 text-white/60 rounded-xl border border-grey-200/50">
                        <p className="text-sm">No families found. Please create a family first.</p>
                      </div>
                    ) : (
                      <>
                        <select
                          id="family"
                          value={familyId}
                          onChange={(e) => {
                            setFamilyId(e.target.value);
                            if (fieldErrors.family) {
                              setFieldErrors(prev => ({ ...prev, family: undefined }));
                            }
                          }}
                          disabled={isSubmitting}
                          className={`w-full px-4 py-3 bg-dark-primary text-white rounded-xl border ${fieldErrors.family ? 'border-red-400' : 'border-grey-200'} focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none`}
                        >
                          <option value="">Select a family</option>
                          {families.map((family) => (
                            <option key={family.family_id} value={family.family_id}>
                              {family.family_name} ({family.primary_contact_name})
                            </option>
                          ))}
                        </select>
                        {fieldErrors.family && (
                          <p className="text-red-400 text-sm mt-1.5">{fieldErrors.family}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <label htmlFor="due-date" className="block text-sm font-semibold text-white mb-2">
                      Due Date <span className="text-brand">*</span>
                    </label>
                    <input
                      id="due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        if (fieldErrors.dueDate) {
                          setFieldErrors(prev => ({ ...prev, dueDate: undefined }));
                        }
                      }}
                      disabled={isSubmitting}
                      className={`w-full px-4 py-3 bg-dark-primary text-white rounded-xl border ${fieldErrors.dueDate ? 'border-red-400' : 'border-grey-200'} focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none`}
                    />
                    {fieldErrors.dueDate && (
                      <p className="text-red-400 text-sm mt-1.5">{fieldErrors.dueDate}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">
                    Line Items <span className="text-brand">*</span>
                  </h2>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-brand text-dark-primary rounded-xl font-semibold text-sm hover:bg-brand-light transition-all disabled:opacity-50"
                  >
                    Add Item
                  </button>
                </div>
                {fieldErrors.items && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 rounded-lg">
                    <p className="text-red-400 text-sm">{fieldErrors.items}</p>
                  </div>
                )}

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={item.id} className="p-4 bg-dark-primary rounded-xl border border-grey-200">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-white font-semibold text-sm">Item {index + 1}</h4>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={isSubmitting}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-5">
                          <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="e.g., Monthly Squad Fee - February"
                            disabled={isSubmitting}
                            className="w-full px-4 py-2.5 bg-dark-primary/80 text-white rounded-lg border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
                          <select
                            value={item.type}
                            onChange={(e) => updateItem(item.id, 'type', e.target.value)}
                            disabled={isSubmitting}
                            className="w-full px-4 py-2.5 bg-dark-primary/80 text-white rounded-lg border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                          >
                            <option value="squad_fee">Squad Fee</option>
                            <option value="membership">Membership</option>
                            <option value="gala_entry">{galaEntryLabel}</option>
                            <option value="merchandise">Merchandise</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-sm font-medium text-text-secondary mb-1.5">Amount ({symbol})</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.amount}
                            onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                            placeholder="0.00"
                            disabled={isSubmitting}
                            className="w-full px-4 py-2.5 bg-dark-primary/80 text-white rounded-lg border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="bg-brand/10 border-2 border-brand rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-semibold text-white">Total Amount:</span>
                  <span className="text-4xl font-serif text-brand tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-dark-primary rounded-3xl p-6 shadow-lg border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">
                  Notes <span className="text-text-tertiary text-sm font-normal">(optional)</span>
                </h2>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional notes or payment instructions..."
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-dark-primary text-white rounded-xl border border-grey-200 focus:border-brand focus:ring-1 focus:ring-brand transition-all outline-none"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2 pb-8">
                <button
                  type="button"
                  onClick={async () => {
                    if (hasUnsavedChanges) {
                      const confirmed = await confirm({
                        title: 'Unsaved Changes',
                        description: 'You have unsaved changes. Are you sure you want to leave? All entered data will be lost.',
                        confirmLabel: 'Leave Page',
                        cancelLabel: 'Keep Editing',
                        variant: 'warning',
                      });
                      if (!confirmed) return;
                    }
                    router.push('/billing');
                  }}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-grey-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-brand text-dark-primary rounded-full font-bold hover:bg-brand-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Invoice</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
