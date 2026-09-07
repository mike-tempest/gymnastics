'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useClubRegion } from '@/hooks/useClubRegion';
import { AwardLevel, CreateAwardLevelInput, feeAmount } from '@/lib/api/awards';
import { currencySymbol } from '@/lib/utils/currency';

const optionalFee = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '' || value === null) return null;
    return Number(value);
  })
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), {
    message: 'Please enter an amount of zero or more, or leave it blank',
  })
  .refine((value) => value === null || value <= 10000, {
    message: 'A badge fee cannot exceed 10,000. Please check the value entered.',
  });

const levelSchema = z.object({
  name: z
    .string()
    .min(1, 'Please give this badge a name')
    .max(200, 'The name must be under 200 characters'),
  description: z.string().max(1000, 'The description must be under 1000 characters').optional(),
  sort_order: z.coerce
    .number()
    .int('The order must be a whole number')
    .min(0, 'The order cannot be negative'),
  badge_fee: optionalFee,
  certificate_fee: optionalFee,
  active: z.boolean(),
});

export type LevelFormData = z.input<typeof levelSchema>;

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
      sort_order: level?.sort_order ?? nextSortOrder,
      badge_fee: feeAmount(level?.badge_fee) ?? '',
      certificate_fee: feeAmount(level?.certificate_fee) ?? '',
      active: level?.active ?? true,
    });
  }, [isOpen, level, nextSortOrder, reset]);

  if (!isOpen) return null;

  const submit = handleSubmit(async (data) => {
    const parsed = levelSchema.parse(data);
    await onSubmit({
      name: parsed.name,
      description: parsed.description?.trim() ? parsed.description : null,
      sort_order: parsed.sort_order,
      badge_fee: parsed.badge_fee,
      certificate_fee: parsed.certificate_fee,
      active: parsed.active,
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
