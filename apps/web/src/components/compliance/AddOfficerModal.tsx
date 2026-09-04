'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { createSafeguardingOfficer } from '@/lib/api/compliance';

const addOfficerSchema = z.object({
  name: z.string().min(1, 'Enter the officer name'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional(),
  dbs_number: z.string().optional(),
  dbs_expiry: z.string().optional(),
  qualifications: z.string().optional(),
});

type AddOfficerForm = z.infer<typeof addOfficerSchema>;

interface AddOfficerModalProps {
  /** What the governing body calls the officer (e.g. "Club Welfare Officer"). */
  officerLabel: string;
  /** Label for the officer's background-check number field. */
  certificateLabel: string;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Minimal add form for the club's designated safeguarding officer, wired to
 * the existing officers CRUD endpoint. The officer's role is recorded as the
 * governing body's own title for the position.
 */
export default function AddOfficerModal({
  officerLabel,
  certificateLabel,
  onClose,
  onCreated,
}: AddOfficerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddOfficerForm>({ resolver: zodResolver(addOfficerSchema) });

  const onSubmit = async (form: AddOfficerForm) => {
    setIsSubmitting(true);
    try {
      await createSafeguardingOfficer({
        name: form.name.trim(),
        role: officerLabel,
        email: form.email.trim(),
        phone: form.phone?.trim() || undefined,
        dbs_number: form.dbs_number?.trim() || undefined,
        dbs_expiry: form.dbs_expiry || undefined,
        qualifications: form.qualifications?.trim() || undefined,
      });
      toast.success(`${officerLabel} added.`);
      onCreated();
      onClose();
    } catch {
      toast.error(`Could not add the ${officerLabel}. Please try again.`);
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
      aria-labelledby="add-officer-title"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-dark-primary rounded-3xl border border-white/10 shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 id="add-officer-title" className="font-serif text-2xl text-white">
            Add {officerLabel}
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
            <label htmlFor="officer-name" className={labelClass}>
              Name
            </label>
            <input {...register('name')} id="officer-name" type="text" className={fieldClass} />
            {errors.name && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="officer-email" className={labelClass}>
              Email
            </label>
            <input {...register('email')} id="officer-email" type="email" className={fieldClass} />
            {errors.email && (
              <p className="mt-2 text-sm text-danger font-semibold">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="officer-phone" className={labelClass}>
              Phone <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input {...register('phone')} id="officer-phone" type="tel" className={fieldClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="officer-check-number" className={labelClass}>
                {certificateLabel} <span className="font-normal text-white/50">(optional)</span>
              </label>
              <input {...register('dbs_number')} id="officer-check-number" type="text" className={fieldClass} />
            </div>
            <div>
              <label htmlFor="officer-check-expiry" className={labelClass}>
                Check expiry <span className="font-normal text-white/50">(optional)</span>
              </label>
              <input {...register('dbs_expiry')} id="officer-check-expiry" type="date" className={fieldClass} />
            </div>
          </div>

          <div>
            <label htmlFor="officer-qualifications" className={labelClass}>
              Qualifications <span className="font-normal text-white/50">(optional)</span>
            </label>
            <input {...register('qualifications')} id="officer-qualifications" type="text" className={fieldClass} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-dark transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save officer'}
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
