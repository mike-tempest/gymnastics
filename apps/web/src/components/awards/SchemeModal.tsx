'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AwardScheme, CreateAwardSchemeInput } from '@/lib/api/awards';

const schemeSchema = z.object({
  name: z
    .string()
    .min(1, 'Please give this award scheme a name')
    .max(200, 'The name must be under 200 characters'),
  description: z.string().max(1000, 'The description must be under 1000 characters').optional(),
  source: z.enum(['bg-rise', 'legacy-proficiency', 'custom']),
  active: z.boolean(),
});

export type SchemeFormData = z.infer<typeof schemeSchema>;

interface SchemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAwardSchemeInput) => Promise<void>;
  scheme?: AwardScheme | null;
  isLoading?: boolean;
}

export default function SchemeModal({
  isOpen,
  onClose,
  onSubmit,
  scheme,
  isLoading = false,
}: SchemeModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SchemeFormData>({
    resolver: zodResolver(schemeSchema),
    mode: 'onTouched',
    defaultValues: { name: '', description: '', source: 'custom', active: true },
  });

  useEffect(() => {
    if (!isOpen) return;
    reset({
      name: scheme?.name ?? '',
      description: scheme?.description ?? '',
      source: scheme?.source ?? 'custom',
      active: scheme?.active ?? true,
    });
  }, [isOpen, scheme, reset]);

  if (!isOpen) return null;

  const submit = handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      description: data.description?.trim() ? data.description : null,
      source: data.source,
      active: data.active,
    });
  });

  const busy = isLoading || isSubmitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-dark-primary rounded-3xl border border-white/20 shadow-lg p-6 sm:p-8">
        <h2 className="font-serif text-3xl text-white mb-6">
          {scheme ? 'Edit award scheme' : 'New award scheme'}
        </h2>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="scheme-name" className="block text-sm font-semibold text-white mb-2">
              Name
            </label>
            <input
              id="scheme-name"
              type="text"
              autoFocus
              {...register('name')}
              className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="For example, our own club badges"
            />
            {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
          </div>

          <div>
            <label
              htmlFor="scheme-description"
              className="block text-sm font-semibold text-white mb-2"
            >
              Description
            </label>
            <textarea
              id="scheme-description"
              rows={3}
              {...register('description')}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-text-tertiary focus:border-brand focus:outline-none"
              placeholder="What this scheme covers and who it is for"
            />
            {errors.description && (
              <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="scheme-source" className="block text-sm font-semibold text-white mb-2">
              Scheme type
            </label>
            <select
              id="scheme-source"
              {...register('source')}
              className="w-full min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
            >
              <option value="bg-rise">British Gymnastics Rise</option>
              <option value="legacy-proficiency">Legacy Proficiency Awards</option>
              <option value="custom">Our own scheme</option>
            </select>
            <p className="mt-2 text-sm text-text-tertiary">
              This only labels the scheme and decides what the Rise export includes. Every scheme
              behaves the same way.
            </p>
          </div>

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
              {busy ? 'Saving...' : scheme ? 'Save changes' : 'Create scheme'}
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
