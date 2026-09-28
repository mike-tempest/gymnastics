'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import {
  SkillCriterion,
  createCriterion,
  getAwardSchemes,
  getCriteria,
  setNextLevel,
  updateCriterion,
} from '@/lib/api/awards';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a skill name').max(200),
  guidance: z.string().max(4000),
  sort_order: z.coerce.number().int().min(0).max(10000),
  required: z.boolean(),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;
function CriterionForm({
  level,
  criterion,
  onSaved,
}: {
  level: string;
  criterion?: SkillCriterion;
  onSaved: () => void;
}) {
  const [error, setError] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: criterion?.name ?? '',
      guidance: criterion?.guidance ?? '',
      sort_order: criterion?.sort_order ?? 0,
      required: criterion?.required ?? true,
      active: criterion?.active ?? true,
    },
  });
  return (
    <form
      className="grid gap-4 rounded-xl border border-grey-200 bg-surface p-4 shadow-sm md:grid-cols-2"
      onSubmit={form.handleSubmit(async (values) => {
        setError('');
        try {
          if (criterion)
            await updateCriterion(criterion.criterion_id, {
              ...values,
              version: criterion.version,
            });
          else await createCriterion(level, values);
          form.reset();
          onSaved();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Could not save skill');
        }
      })}
    >
      <label>
        Skill name
        <input
          className="block w-full min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
          {...form.register('name')}
        />
      </label>
      <label>
        Display order
        <input
          className="block w-full min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
          type="number"
          min={0}
          {...form.register('sort_order')}
        />
      </label>
      <label className="md:col-span-2">
        Guidance visible to coaches and parents
        <textarea
          className="block w-full min-h-24 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
          {...form.register('guidance')}
        />
      </label>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" {...form.register('required')} />
        Required for this badge
      </label>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" {...form.register('active')} />
        Active criterion
      </label>
      <p className="text-sm text-text-secondary md:col-span-2">
        Archive a skill by clearing Active criterion. Earlier assessments keep the name and guidance
        used at the time.
      </p>
      {Object.values(form.formState.errors).map((e, i) => (
        <p role="alert" key={i}>
          {e.message}
        </p>
      ))}
      {error && <p role="alert">{error}</p>}
      <Button className="min-h-12" disabled={form.formState.isSubmitting}>
        {criterion ? 'Save skill' : 'Add skill'}
      </Button>
    </form>
  );
}
export default function CriteriaPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const schemes = useQuery({
    queryKey: ['award-schemes-all'],
    queryFn: () => getAwardSchemes(true),
  });
  const criteria = useQuery({
    queryKey: ['award-criteria', params.id],
    queryFn: () => getCriteria(params.id),
  });
  const scheme = schemes.data?.find((s) => s.levels.some((l) => l.level_id === params.id));
  const level = scheme?.levels.find((l) => l.level_id === params.id);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['award-criteria', params.id] });
    setMessage('Skill saved.');
  };
  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6 text-text-primary">
        <Link href="/awards" className="inline-flex min-h-12 items-center underline">
          Back to awards
        </Link>
        <h1 className="font-serif text-3xl">{level?.name ?? 'Badge'} skills</h1>
        <p>
          Use your club’s criteria or material you have permission to use. Skills and progression
          are configurable for every scheme.
        </p>
        {(schemes.isError || criteria.isError) && <p role="alert">Could not load this badge.</p>}
        <p role="status">{message}</p>
        {level && (
          <label className="block">
            Suggested next badge
            <select
              className="ml-3 min-h-12 rounded-lg bg-surface p-3"
              value={level.next_level_id ?? ''}
              onChange={async (e) => {
                try {
                  await setNextLevel(params.id, e.target.value || null);
                  await queryClient.invalidateQueries({ queryKey: ['award-schemes-all'] });
                  setMessage('Progression saved.');
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Could not save progression');
                }
              }}
            >
              <option value="">Next active badge in display order</option>
              {scheme?.levels
                .filter((l) => l.active && l.level_id !== params.id)
                .map((l) => (
                  <option value={l.level_id} key={l.level_id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {criteria.data?.map((criterion) => (
          <CriterionForm
            key={`${criterion.criterion_id}:${criterion.version}`}
            level={params.id}
            criterion={criterion}
            onSaved={refresh}
          />
        ))}
        {level?.active && (
          <section className="space-y-3">
            <h2 className="text-xl">Add a skill</h2>
            <CriterionForm level={params.id} onSaved={refresh} />
          </section>
        )}
      </div>
    </MainLayout>
  );
}
