'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import { AwardLevel, CreateAwardLevelInput, feeAmount } from '@/lib/api/awards';
import { currencySymbol } from '@/lib/utils/currency';

/**
 * A blank fee means free, so a fee field is validated as the string the input
 * actually holds and converted on submit. Transforming inside the schema would
 * make the form's input and output types differ, which the resolver typing
 * does not carry through to the submit handler.
 */
function feeNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

const optionalFee = z
  .string()
  .optional()
  .refine((value) => value === undefined || value.trim() === '' || feeNumber(value) !== null, {
    message: 'Please enter an amount, or leave it blank',
  })
  .refine((value) => (feeNumber(value) ?? 0) >= 0, {
    message: 'Please enter an amount of zero or more, or leave it blank',
  })
  .refine((value) => (feeNumber(value) ?? 0) <= 10000, {
    message: 'A badge fee cannot exceed 10,000. Please check the value entered.',
  });

const levelSchema = z.object({
  name: z
    .string()
    .min(1, 'Please give this badge a name')
    .max(200, 'The name must be under 200 characters'),
  description: z.string().max(1000, 'The description must be under 1000 characters').optional(),
  // A string for the same reason as the fees. Coercing here would read an
  // emptied number input as zero and silently move the badge to the front of
  // the scheme, rather than asking the club what it meant.
  sort_order: z
    .string()
    .min(1, 'Please give this badge a position in the scheme')
    .refine((value) => Number.isInteger(Number(value)), 'The order must be a whole number')
    .refine((value) => Number(value) >= 0, 'The order cannot be negative'),
  badge_fee: optionalFee,
  certificate_fee: optionalFee,
  active: z.boolean(),
});

/** What the inputs hold. A fee stays a string here and is converted on submit. */
type LevelFormData = z.infer<typeof levelSchema>;

interface LevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateAwardLevelInput, 'scheme_id'>) => Promise<void>;
  level?: AwardLevel | null;
  schemeName: string;
  /** Suggested position for a new badge, so a club does not have to work it out. */
  nextSortOrder: number;
  isLoading?: boolean;
}

export default function LevelModal({
  isOpen,
  onClose,
  onSubmit,
  level,
  schemeName,
  nextSortOrder,
  isLoading = false,
}: LevelModalProps) {
  const { currency, locale } = useClubRegion();
  const symbol = currencySymbol(currency, locale);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<LevelFormData>({
    resolver: zodResolver(levelSchema),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: level?.name ?? '',
      description: level?.description ?? '',
      sort_order: String(level?.sort_order ?? nextSortOrder),
      badge_fee: String(feeAmount(level?.badge_fee) ?? ''),
      certificate_fee: String(feeAmount(level?.certificate_fee) ?? ''),
      active: level?.active ?? true,
    });
  }, [isOpen, level, nextSortOrder, reset]);

  if (!isOpen) return null;

  const submit = handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      description: data.description?.trim() ? data.description : null,
      sort_order: Number(data.sort_order),
      badge_fee: feeNumber(data.badge_fee),
      certificate_fee: feeNumber(data.certificate_fee),
      active: data.active,
    });
  });

  const busy = isLoading || isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-dark-primary rounded-3xl border border-white/20 shadow-lg p-6 sm:p-8 my-8">
        <h2 className="font-serif text-3xl text-white mb-2">
          {level ? 'Edit badge' : 'New badge'}
        </h2>
        <p className="text-text-secondary text-sm mb-6">{schemeName}</p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="level-name" className="block text-sm font-semibold text-white mb-2">
              Badge name
            </label>
            <input
              id="level-name"
              type="text"
              autoFocus
              {...register('name')}
              className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="For example, Explore 3"
            />
            {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <label
              htmlFor="level-description"
              className="block text-sm font-semibold text-white mb-2"
            >
              Description
            </label>
            <textarea
              id="level-description"
              rows={2}
              {...register('description')}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="What a gymnast has to show to earn this badge"
            />
          </div>

          <div>
            <label
              htmlFor="level-sort-order"
              className="block text-sm font-semibold text-white mb-2"
            >
              Order
            </label>
            <input
              id="level-sort-order"
              type="number"
              min={0}
              {...register('sort_order')}
              className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
            />
            <p className="mt-2 text-sm text-text-tertiary">
              Badges are listed from the lowest number up, so this is the order your gymnasts work
              through them.
            </p>
            {errors.sort_order && (
              <p className="mt-2 text-sm text-red-400">{errors.sort_order.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="level-badge-fee"
                className="block text-sm font-semibold text-white mb-2"
              >
                Badge fee ({symbol})
              </label>
              <input
                id="level-badge-fee"
                type="number"
                step="0.01"
                min={0}
                {...register('badge_fee')}
                className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="Leave blank for free"
              />
              {errors.badge_fee && (
                <p className="mt-2 text-sm text-red-400">{errors.badge_fee.message}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="level-certificate-fee"
                className="block text-sm font-semibold text-white mb-2"
              >
                Certificate fee ({symbol})
              </label>
              <input
                id="level-certificate-fee"
                type="number"
                step="0.01"
                min={0}
                {...register('certificate_fee')}
                className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                placeholder="Leave blank for none"
              />
              {errors.certificate_fee && (
                <p className="mt-2 text-sm text-red-400">{errors.certificate_fee.message}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-text-tertiary">
            A priced badge is invoiced to the family when it is awarded, and collected by Direct
            Debit like any other fee.
          </p>

          <label className="flex items-center gap-3 text-white">
            <input
              type="checkbox"
              {...register('active')}
              className="w-5 h-5 rounded border-white/20 bg-white/5"
            />
            <span className="text-sm font-semibold">In use</span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="flex-1 min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all disabled:opacity-50"
            >
              {busy ? 'Saving...' : level ? 'Save changes' : 'Add badge'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 min-h-[48px] px-6 py-3 bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
