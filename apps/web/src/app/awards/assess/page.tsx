'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import {
  getAwardSchemes,
  getSkillContext,
  getSkillHistory,
  previewAwardFees,
  recordAssessment,
  saveSkillAssessment,
  FeePreview,
  SkillContext,
} from '@/lib/api/awards';
import { getSquads } from '@/lib/api/squads';
import { MEMBER_NOUN_PLURAL } from '@/lib/brand';

const settingsSchema = z.object({
  level_id: z.string().uuid('Choose a badge'),
  squad_id: z.string(),
  assessed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
});
type Settings = z.infer<typeof settingsSchema>;
type Result = {
  status: 'working_towards' | 'achieved';
  internal_note: string;
  parent_note: string;
};
const control = 'min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary';

function History({ member, level }: { member: string; level: string }) {
  const history = useQuery({
    queryKey: ['skill-history', member, level],
    queryFn: () => getSkillHistory(member, level),
  });
  return (
    <div className="space-y-3 p-3" aria-live="polite">
      {history.isPending
        ? 'Loading history…'
        : history.isError
          ? 'Could not load history.'
          : history.data.length
            ? history.data.map((row) => (
                <article key={row.assessment_id} className="border-b border-grey-200 pb-3">
                  <p>
                    {row.assessed_on}: {row.criterion_name}, {row.status.replaceAll('_', ' ')}
                  </p>
                  {row.assessor_name && <p>Assessed by {row.assessor_name}</p>}
                  {row.internal_note && <p>Staff note: {row.internal_note}</p>}
                  {row.parent_note && <p>Parent note: {row.parent_note}</p>}
                </article>
              ))
            : 'No skill assessments recorded.'}
    </div>
  );
}
function Register({
  context,
  settings,
  sessionId,
}: {
  context: SkillContext;
  settings: Settings;
  sessionId?: string;
}) {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<Record<string, Result>>({});
  const [awards, setAwards] = useState<string[]>([]);
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [historyMember, setHistoryMember] = useState('');
  const [revision, setRevision] = useState(0);
  const contextQuery = useQuery({
    queryKey: ['skill-register', settings.level_id, sessionId, settings.squad_id],
    queryFn: () => getSkillContext(settings.level_id, sessionId, settings.squad_id),
    initialData: context,
    initialDataUpdatedAt: 0,
  });
  const data = contextQuery.data;
  const pending = useRef<{ kind: string; body: unknown } | null>(null);
  const criteria = data.criteria.filter((c) => c.active);
  const update = (key: string, patch: Partial<Result>) => {
    setResults((old) => ({
      ...old,
      [key]: {
        ...(old[key] ?? { status: 'working_towards', internal_note: '', parent_note: '' }),
        ...patch,
      },
    }));
  };
  const send = async (kind: 'skills' | 'award', bill = false) => {
    setBusy(true);
    setMessage('');
    try {
      // Keep exactly the same request after an uncertain response. Editing is
      // disabled until it is resolved, so retry cannot silently submit new data.
      let body = pending.current?.body;
      if (!body) {
        body =
          kind === 'skills'
            ? {
                request_key: crypto.randomUUID(),
                level_id: settings.level_id,
                assessed_on: settings.assessed_on,
                ...(sessionId
                  ? { session_id: sessionId }
                  : settings.squad_id
                    ? { squad_id: settings.squad_id }
                    : {}),
                results: Object.entries(results).map(([key, value]) => {
                  const [member_id, criterion_id] = key.split(':');
                  return {
                    ...value,
                    member_id,
                    criterion_id,
                    expected_version:
                      data.progress.find(
                        (p) => p.member_id === member_id && p.criterion_id === criterion_id
                      )?.version ?? 0,
                    criterion_version: criteria.find((c) => c.criterion_id === criterion_id)!
                      .version,
                  };
                }),
              }
            : {
                request_key: crypto.randomUUID(),
                level_id: settings.level_id,
                assessed_at: settings.assessed_on,
                bill_fees: bill,
                ...(bill && preview ? { fee_preview_hash: preview.hash } : {}),
                outcomes: awards.map((member_id) => ({ member_id, outcome: 'awarded' as const })),
              };
        pending.current = { kind, body };
      }
      if (pending.current?.kind === 'skills') await saveSkillAssessment(body);
      else await recordAssessment(body as Parameters<typeof recordAssessment>[0]);
      const savedKind = pending.current?.kind;
      pending.current = null;
      if (savedKind === 'skills') setResults({});
      else {
        setAwards([]);
        setPreview(null);
      }
      await contextQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ['skill-history'] });
      setRevision((v) => v + 1);
      setMessage('Saved. Skill progress, awards and fees remain separate records.');
    } catch (error) {
      const status =
        (error as { status?: number; statusCode?: number }).status ??
        (error as { statusCode?: number }).statusCode;
      if (status && status >= 400 && status < 500) {
        pending.current = null;
        setPreview(null);
        if (status === 409) {
          setResults({});
          setAwards([]);
          await contextQuery.refetch();
        }
      }
      setMessage(
        error instanceof Error
          ? `${error.message}${status === 409 ? ' No changes saved. Review the history and select results again.' : ''}`
          : 'Could not confirm the save. Retry the same request.'
      );
    } finally {
      setBusy(false);
    }
  };
  const familyFees = Array.from(
    (preview?.rows ?? [])
      .reduce((groups, row) => {
        const key = row.family_id ?? row.member_id;
        const group = groups.get(key) ?? {
          name: row.family_name ?? 'No family linked',
          pence: 0,
          rows: [],
        };
        group.pence += Math.round(row.total_amount * 100);
        group.rows.push(row);
        groups.set(key, group);
        return groups;
      }, new Map<string, { name: string; pence: number; rows: FeePreview['rows'] }>())
      .entries()
  );
  const locked = busy || !!pending.current;
  return (
    <div className="space-y-6">
      <p role="status" className="text-text-secondary">
        {message}
      </p>
      {pending.current && !busy && (
        <Button
          className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
          onClick={() => void send(pending.current!.kind as 'skills' | 'award')}
        >
          Retry the same save
        </Button>
      )}
      {contextQuery.isError && (
        <p role="alert">Could not refresh progress. Reload before making another assessment.</p>
      )}
      <fieldset
        disabled={
          locked ||
          contextQuery.isFetching ||
          contextQuery.isError ||
          data.session?.status === 'cancelled'
        }
        className="space-y-6"
      >
        <legend className="text-xl font-semibold">{MEMBER_NOUN_PLURAL} and skills</legend>
        {data.session?.status === 'cancelled' && <p>This session is cancelled.</p>}
        {!criteria.length && (
          <p>No skills configured for this badge. An administrator can add criteria from Awards.</p>
        )}
        {!data.members.length && <p>No one is on this register.</p>}
        {data.members.map((member) => {
          const name = `${member.first_name} ${member.last_name}`;
          const badgeProgress = data.level_progress?.find((p) => p.member_id === member.member_id);
          const alreadyAwarded = badgeProgress?.status === 'awarded';
          const required = criteria.filter((c) => c.required);
          const achieved = required.filter((c) =>
            data.progress.some(
              (p) =>
                p.member_id === member.member_id &&
                p.criterion_id === c.criterion_id &&
                p.status === 'achieved'
            )
          ).length;
          return (
            <section
              key={member.member_id}
              className="rounded-xl border border-grey-200 bg-surface p-4 shadow-sm space-y-4"
            >
              <h2 className="text-lg font-semibold">{name}</h2>
              {alreadyAwarded && (
                <p className="font-semibold">
                  Badge awarded
                  {badgeProgress?.awarded_on
                    ? ` on ${badgeProgress.awarded_on.split('-').reverse().join('/')}`
                    : ''}
                  .{badgeProgress?.has_invoice ? ' Fees already invoiced.' : ''}
                </p>
              )}
              <p className="text-text-secondary">
                {achieved} of {required.length} required skills achieved.{' '}
                {!alreadyAwarded && required.length > 0 && achieved === required.length
                  ? 'Ready for a coach to review the badge award.'
                  : ''}
              </p>
              {criteria.map((criterion) => {
                const key = `${member.member_id}:${criterion.criterion_id}`;
                const value = results[key];
                const old = data.progress.find(
                  (p) =>
                    p.member_id === member.member_id && p.criterion_id === criterion.criterion_id
                );
                return (
                  <div
                    key={key}
                    className="grid gap-3 border-t border-grey-200 pt-4 md:grid-cols-2"
                  >
                    <div>
                      <label htmlFor={key} className="block font-medium">
                        {criterion.name}
                        {criterion.required ? ' (required)' : ' (optional)'}
                      </label>
                      {criterion.guidance && (
                        <p className="text-sm text-text-secondary">{criterion.guidance}</p>
                      )}
                      <p className="text-sm text-text-secondary">
                        Currently: {old?.status.replaceAll('_', ' ') ?? 'not assessed'}
                      </p>
                    </div>
                    <select
                      id={key}
                      aria-label={`${name}: ${criterion.name}`}
                      className={control}
                      value={value?.status ?? ''}
                      onChange={(e) => {
                        if (!e.target.value)
                          setResults((previous) => {
                            const next = { ...previous };
                            delete next[key];
                            return next;
                          });
                        else update(key, { status: e.target.value as Result['status'] });
                      }}
                    >
                      <option value="">Leave unchanged</option>
                      <option value="working_towards">Working towards</option>
                      <option value="achieved">Achieved</option>
                    </select>
                    {value && (
                      <>
                        <label>
                          Staff note
                          <textarea
                            className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
                            maxLength={4000}
                            value={value.internal_note}
                            onChange={(e) => update(key, { internal_note: e.target.value })}
                          />
                        </label>
                        <label>
                          Note visible to parents
                          <textarea
                            className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
                            maxLength={4000}
                            value={value.parent_note}
                            onChange={(e) => update(key, { parent_note: e.target.value })}
                          />
                        </label>
                      </>
                    )}
                  </div>
                );
              })}
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  checked={awards.includes(member.member_id)}
                  onChange={(e) => {
                    setPreview(null);
                    setAwards((old) =>
                      e.target.checked
                        ? [...old, member.member_id]
                        : old.filter((id) => id !== member.member_id)
                    );
                  }}
                />
                Select {name} for a badge award
              </label>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
                onClick={() =>
                  setHistoryMember(historyMember === member.member_id ? '' : member.member_id)
                }
              >
                Assessment history for {member.first_name}
              </Button>
              {historyMember === member.member_id && (
                <History
                  key={`${member.member_id}:${revision}`}
                  member={member.member_id}
                  level={settings.level_id}
                />
              )}
            </section>
          );
        })}
        <div className="flex flex-wrap gap-3">
          <Button
            className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
            disabled={!Object.keys(results).length}
            onClick={() => void send('skills')}
          >
            Save skill progress ({Object.keys(results).length})
          </Button>
          <Button
            className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
            variant="outline"
            disabled={!awards.length}
            onClick={() => void send('award')}
          >
            Award badges without fees ({awards.length})
          </Button>
          <Button
            className="min-h-12 rounded-lg border border-grey-200 bg-surface p-3 text-text-primary"
            variant="outline"
            disabled={!awards.length}
            onClick={async () => {
              setBusy(true);
              try {
                setPreview(await previewAwardFees(settings.level_id, awards));
              } catch (e) {
                setMessage(e instanceof Error ? e.message : 'Could not preview fees');
              } finally {
                setBusy(false);
              }
            }}
          >
            Review badge fees
          </Button>
        </div>
        {preview && (
          <section className="rounded-xl border border-grey-200 bg-surface p-4 shadow-sm space-y-4">
            <h2 className="text-xl">Confirm fees</h2>
            <p>
              These invoices use the normal family billing process, including Direct Debit where
              available.
            </p>
            <ul className="space-y-3">
              {familyFees.map(([key, group]) => (
                <li key={key} className="space-y-2">
                  <p className="font-semibold">
                    {group.name}:{' '}
                    {new Intl.NumberFormat('en-GB', {
                      style: 'currency',
                      currency: preview.currency,
                    }).format(group.pence / 100)}
                  </p>
                  {group.rows.map((row) => (
                    <p key={row.member_id} className="text-sm">
                      {row.member_name}:{' '}
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: preview.currency,
                      }).format(row.total_amount)}
                      {row.reason ? ` (${row.reason.replaceAll('_', ' ')})` : ''}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <Button className="min-h-12" onClick={() => void send('award', true)}>
              Confirm awards and listed fees
            </Button>
          </section>
        )}
      </fieldset>
    </div>
  );
}
function Assessment() {
  const params = useSearchParams();
  const sessionId = params.get('session_id') ?? undefined;
  const schemes = useQuery({ queryKey: ['award-schemes'], queryFn: () => getAwardSchemes() });
  const squads = useQuery({ queryKey: ['squads'], queryFn: () => getSquads() });
  const form = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      level_id: '',
      squad_id: params.get('squad_id') ?? '',
      assessed_on: new Date().toISOString().slice(0, 10),
    },
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const context = useQuery({
    queryKey: ['assessment-context', settings, sessionId],
    queryFn: () => getSkillContext(settings!.level_id, sessionId, settings!.squad_id),
    enabled: !!settings,
  });
  useEffect(() => {
    if (context.data?.session) form.setValue('assessed_on', context.data.session.session_date);
  }, [context.data?.session, form]);
  return (
    <MainLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-6 text-text-primary">
        <h1 className="font-serif text-3xl font-semibold">Assess skills and award badges</h1>
        <p>
          Record only the skills you assessed. Review badge awards and any family fees separately.
        </p>
        <form onSubmit={form.handleSubmit(setSettings)} className="grid gap-4 md:grid-cols-3">
          <label>
            Badge
            <select className={`${control} block w-full`} {...form.register('level_id')}>
              <option value="">Choose a badge</option>
              {schemes.data?.flatMap((s) =>
                s.levels
                  .filter((l) => l.active)
                  .map((l) => (
                    <option key={l.level_id} value={l.level_id}>
                      {s.name}: {l.name}
                    </option>
                  ))
              )}
            </select>
          </label>
          {!sessionId && (
            <label>
              Class
              <select className={`${control} block w-full`} {...form.register('squad_id')}>
                <option value="">All classes</option>
                {squads.data?.map((s) => (
                  <option key={s.squad_id} value={s.squad_id}>
                    {s.squad_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {sessionId ? 'Session date is used from the register' : 'Assessment date'}
            <input
              className={`${control} block w-full`}
              readOnly={!!sessionId}
              type="date"
              {...form.register('assessed_on')}
            />
          </label>
          <Button type="submit" className="min-h-12">
            Load register
          </Button>
          {Object.values(form.formState.errors).map((error, i) => (
            <p role="alert" key={i}>
              {error.message}
            </p>
          ))}
        </form>
        {(schemes.isError || squads.isError || context.isError) && (
          <p role="alert">Could not load assessment data. Please reload.</p>
        )}
        {settings && context.isFetching && <p>Loading register…</p>}
        {settings && context.data && !context.isFetching && (
          <Register
            key={JSON.stringify(settings)}
            settings={{
              ...settings,
              assessed_on: context.data.session?.session_date ?? settings.assessed_on,
            }}
            sessionId={sessionId}
            context={context.data}
          />
        )}
      </div>
    </MainLayout>
  );
}
export default function AssessAwardsPage() {
  return (
    <Suspense fallback={<p>Loading assessment…</p>}>
      <Assessment />
    </Suspense>
  );
}
