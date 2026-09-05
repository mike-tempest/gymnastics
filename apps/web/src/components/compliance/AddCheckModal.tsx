'use client';

import { type GoverningBodyConfig, checkNoun, orderedBackgroundCheckTypes } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { createDbsCheck } from '@/lib/api/compliance';
import { listUsers } from '@/lib/api/staff';

const addCheckSchema = z.object({
  user_id: z.string().min(1, 'Select a staff member'),
  type_index: z.string().min(1, 'Select a check type'),
  certificate_number: z.string().min(1, 'Enter the check number'),
  issue_date: z.string().min(1, 'Enter the issue date'),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});

type AddCheckForm = z.infer<typeof addCheckSchema>;

interface AddCheckModalProps {
  config: GoverningBodyConfig;
  /** The club's governing_body_region (an AU state code, an SE region, ...). */
  region?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y + years, m - 1, d));
  return date.toISOString().slice(0, 10);
}

/**
 * Minimal add form for background checks. Check types come from the club's
 * governing-body config; when the club's region matches a state code, that
 * state's check types are listed first (interstate checks stay selectable).
 * Where a type has a known renewal period, the expiry date is suggested from
 * the issue date; a manually edited expiry is never overwritten.
 */
export default function AddCheckModal({ config, region, onClose, onCreated }: AddCheckModalProps) {
  const noun = checkNoun(config.backgroundCheckFramework);
  const checkTypes = useMemo(
    () => orderedBackgroundCheckTypes(config, region),
    [config, region],
  );
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'list'],
    queryFn: listUsers,
    retry: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const expiryEdited = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddCheckForm>({
    resolver: zodResolver(addCheckSchema),
    defaultValues: { type_index: '0' },
  });

  const issueDate = watch('issue_date');
  const typeIndex = watch('type_index');

  // Suggest an expiry from the issue date and the selected type's renewal
  // period, unless the user has taken over the expiry field.
  useEffect(() => {
    if (expiryEdited.current) return;
    const type = checkTypes[parseInt(typeIndex ?? '0', 10)];
    if (!issueDate || !type?.renewalYears) return;
    const suggested = addYears(issueDate, type.renewalYears);
    if (suggested) setValue('expiry_date', suggested);
  }, [issueDate, typeIndex, checkTypes, setValue]);

  const onSubmit = async (form: AddCheckForm) => {
    const type = checkTypes[parseInt(form.type_index, 10)];
    if (!type) return;
    setIsSubmitting(true);
    try {
      await createDbsCheck({
        user_id: form.user_id,
        certificate_number: form.certificate_number.trim(),
        check_type: type.value,
        issue_date: form.issue_date,
        expiry_date: form.expiry_date || undefined,
        notes: form.notes?.trim() || undefined,
      });
      toast.success(`${noun} check recorded.`);
      onCreated();
      onClose();
    } catch {
      toast.error(`Could not record the ${noun} check. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    'w-full px-4 py-3 min-h-[44px] rounded-xl bg-white/5 border border-white/20 text-white focus:border-brand focus:ring-2 focus:ring-brand focus:ring-opacity-50 outline-none transition-all';
  const labelClass = 'block text-sm font-semibold text-white/80 mb-2';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-check-title"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-dark-primary rounded-3xl border border-white/10 shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 id="add-check-title" className="font-serif text-2xl text-white">
            Add {noun} check
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="check-user" className={labelClass}>
              Staff member or volunteer
            </label>
            <select {...register('user_id')} id="check-user" className={fieldClass} disabled={usersLoading}>
              <option value="" className="text-dark-primary">
                {usersLoading ? 'Loading members...' : 'Select a member'}
              </option>
              {(users ?? []).map((user) => (
                <option key={user.user_id} value={user.user_id} className="text-dark-primary">
                  {user.first_name} {user.last_name}
                </option>
              ))}
            </select>
            {errors.user_id && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.user_id.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="check-type" className={labelClass}>
              Check type
            </label>
            <select {...register('type_index')} id="check-type" className={fieldClass}>
              {checkTypes.map((type, index) => (
                <option key={`${type.value}-${index}`} value={String(index)} className="text-dark-primary">
                  {type.label}
                </option>
              ))}
            </select>
            {errors.type_index && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.type_index.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="check-number" className={labelClass}>
              {config.certificateNumberLabel}
            </label>
            <input {...register('certificate_number')} id="check-number" type="text" className={fieldClass} />
            {errors.certificate_number && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.certificate_number.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="check-issue-date" className={labelClass}>
                Issue date
              </label>
              <input {...register('issue_date')} id="check-issue-date" type="date" className={fieldClass} />
              {errors.issue_date && (
                <p className="mt-2 text-sm text-danger font-semibold">{errors.issue_date.message}</p>
              )}
            </div>
            <div>
              <label htmlFor="check-expiry-date" className={labelClass}>
                Expiry date
              </label>
              <input
                {...register('expiry_date', {
                  onChange: () => {
                    expiryEdited.current = true;
                  },
                })}
                id="check-expiry-date"
                type="date"
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="check-notes" className={labelClass}>
              Notes <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input {...register('notes')} id="check-notes" type="text" className={fieldClass} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save check'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 min-h-[44px] rounded-button font-semibold bg-white/5 border border-white/10 text-white hover:border-brand transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
