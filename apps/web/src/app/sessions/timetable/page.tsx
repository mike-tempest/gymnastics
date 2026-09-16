'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { getSessions } from '@/lib/api/sessions';
import { getSquads } from '@/lib/api/squads';
import {
  createTimetable,
  editOccurrence,
  getTimetables,
  previewTimetable,
  SeriesDefinition,
  Timetable,
  TimetableInput,
  TimetablePreview,
} from '@/lib/api/timetables';
import { MEMBER_NOUN_PLURAL } from '@/lib/brand';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date');
const slotSchema = z
  .object({
    squad_id: z.string().uuid('Choose a squad'),
    session_name: z.string().trim().min(1).max(200),
    weekday: z.coerce.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    location: z.string().max(200),
    coach_name: z.string().max(100),
    description: z.string().max(5000),
    max_participants: z
      .string()
      .refine(
        (value) => !value || (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 10000),
        'Enter a positive whole number'
      ),
    excluded_dates: z.string().refine(
      (value) =>
        value
          .split(/[\s,]+/)
          .filter(Boolean)
          .every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
      'Use dates as YYYY-MM-DD, separated by commas'
    ),
  })
  .refine((value) => value.end_time > value.start_time, {
    path: ['end_time'],
    message: 'End time must be after start time',
  });
const schema = z
  .object({
    name: z.string().trim().min(1).max(200),
    start_date: date,
    end_date: date,
    series: z.array(slotSchema).min(1).max(50),
  })
  .refine((value) => value.end_date >= value.start_date, {
    path: ['end_date'],
    message: 'End date must be on or after start date',
  });
type FormValues = z.infer<typeof schema>;
const blankSlot = {
  squad_id: '',
  session_name: '',
  weekday: 1,
  start_time: '17:00',
  end_time: '18:00',
  location: '',
  coach_name: '',
  description: '',
  max_participants: '',
  excluded_dates: '',
};
const emptyForm: FormValues = {
  name: '',
  start_date: '',
  end_date: '',
  series: [{ ...blankSlot }],
};
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const control =
  'mt-1 min-h-12 w-full rounded-md border border-grey-300 bg-white px-3 py-2 text-dark-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand';
const displayDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB');
function formSlot(slot: SeriesDefinition) {
  return {
    ...slot,
    location: slot.location ?? '',
    coach_name: slot.coach_name ?? '',
    description: slot.description ?? '',
    max_participants: slot.max_participants?.toString() ?? '',
    excluded_dates: slot.excluded_dates.join(', '),
  };
}
function apiSlot(slot: FormValues['series'][number]): SeriesDefinition {
  return {
    ...slot,
    max_participants: slot.max_participants ? Number(slot.max_participants) : undefined,
    excluded_dates: Array.from(new Set(slot.excluded_dates.split(/[\s,]+/).filter(Boolean))).sort(),
  };
}

export default function TimetablePage() {
  const { data: auth } = useSession();
  const canManage = ['super_admin', 'head_coach'].includes(String(auth?.user?.role).toLowerCase());
  const queryClient = useQueryClient();
  const terms = useQuery({ queryKey: ['timetables'], queryFn: getTimetables, enabled: canManage });
  const squads = useQuery({
    queryKey: ['timetable-squads'],
    queryFn: () => getSquads(),
    enabled: canManage,
  });
  const sessions = useQuery({
    queryKey: ['timetable-sessions'],
    queryFn: getSessions,
    enabled: canManage,
  });
  const [source, setSource] = useState<Timetable | null>(null);
  const [editing, setEditing] = useState<{ term: Timetable; seriesId: string } | null>(null);
  const [occurrence, setOccurrence] = useState('');
  const [scope, setScope] = useState<'one' | 'future'>('future');
  const [movedDate, setMovedDate] = useState('');
  const [preview, setPreview] = useState<{
    result: TimetablePreview;
    input: TimetableInput;
  } | null>(null);
  const [message, setMessage] = useState('');
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyForm });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'series' });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['timetables'] }),
      queryClient.invalidateQueries({ queryKey: ['timetable-sessions'] }),
    ]);
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      setMessage('');
      if (editing) {
        if (!occurrence) throw new Error('Choose the first session to change');
        const result = await editOccurrence(occurrence, {
          scope,
          definition: apiSlot(values.series[0]),
          ...(scope === 'one' && movedDate ? { session_date: movedDate } : {}),
        });
        setMessage(
          `${result.updated} sessions updated. ${result.skipped.length} kept unchanged${result.skipped.length ? ': ' + result.skipped.map((s) => `${displayDate(s.date)} (${s.reason})`).join(', ') : '.'}`
        );
        await refresh();
      } else {
        const input: TimetableInput = {
          ...values,
          series: values.series.map((slot, index) =>
            source
              ? { ...source.series[index].definition, excluded_dates: apiSlot(slot).excluded_dates }
              : apiSlot(slot)
          ),
          ...(source ? { source_term_id: source.term_id } : {}),
          operation_id: crypto.randomUUID(),
        };
        setPreview({ result: await previewTimetable(input), input });
      }
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      const result = await createTimetable({
        ...preview.input,
        preview_token: preview.result.preview_token,
      });
      setMessage(
        result.already_created
          ? 'This term was already rolled over. No duplicate sessions were created.'
          : 'Timetable saved. Sessions are available in registers and parent schedules.'
      );
      setPreview(null);
      setSource(null);
      form.reset(emptyForm);
      await refresh();
    },
  });
  function startNew() {
    setEditing(null);
    setSource(null);
    setPreview(null);
    setMessage('');
    mutation.reset();
    save.reset();
    form.reset(emptyForm);
  }
  function rollover(term: Timetable) {
    startNew();
    setSource(term);
    form.reset({
      name: '',
      start_date: '',
      end_date: '',
      series: term.series.map((s) => formSlot({ ...s.definition, excluded_dates: [] })),
    });
    document.getElementById('timetable-form')?.scrollIntoView({ behavior: 'smooth' });
  }
  function edit(term: Timetable, seriesId: string) {
    startNew();
    setEditing({ term, seriesId });
    setScope('future');
    setMovedDate('');
    const slot = term.series.find((s) => s.series_id === seriesId)!;
    const first = sessions.data
      ?.filter((s) => s.series_id === seriesId)
      .sort((a, b) => a.session_date.localeCompare(b.session_date))
      .find(
        (s) =>
          s.status === 'scheduled' && new Date(`${s.session_date}T${s.start_time}`) > new Date()
      );
    setOccurrence(first?.session_id ?? '');
    form.reset({
      name: term.name,
      start_date: term.start_date,
      end_date: term.end_date,
      series: [formSlot(slot.definition)],
    });
    document.getElementById('timetable-form')?.scrollIntoView({ behavior: 'smooth' });
  }
  function chooseOccurrence(id: string, nextScope: 'one' | 'future' = scope) {
    setOccurrence(id);
    setScope(nextScope);
    setMovedDate('');
    if (!editing) return;
    const definition = editing.term.series.find(
      (item) => item.series_id === editing.seriesId
    )!.definition;
    const session = sessions.data?.find((item) => item.session_id === id);
    if (nextScope === 'one' && session) {
      const selectedDate = session.session_date.slice(0, 10);
      const excludedDates = definition.excluded_dates.filter((date) => date !== selectedDate);
      if (session.status === 'cancelled') excludedDates.push(selectedDate);
      form.setValue(
        'series.0',
        formSlot({
          ...definition,
          ...session,
          squad_id: definition.squad_id,
          start_time: session.start_time.slice(0, 5),
          end_time: session.end_time.slice(0, 5),
          excluded_dates: excludedDates,
        })
      );
    } else {
      form.setValue('series.0', formSlot(definition));
    }
  }
  const error = mutation.error ?? save.error ?? terms.error ?? squads.error ?? sessions.error;
  const busy = mutation.isPending || save.isPending;
  return (
    <MainLayout>
      <main className="mx-auto max-w-5xl space-y-8 p-6 text-dark-primary sm:p-10">
        <header>
          <Link href="/sessions" className="inline-flex min-h-12 items-center underline">
            Back to sessions
          </Link>
          <h1 className="font-serif text-3xl">Term timetables</h1>
          <p className="mt-2 text-grey-600">
            Plan weekly sessions, holidays and the next term. Timetable changes do not change fees
            or enrolments.
          </p>
        </header>
        {!canManage ? (
          <p>Timetables can be managed by a club administrator or head coach.</p>
        ) : (
          <>
            {error && (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">
                {error instanceof Error
                  ? error.message
                  : 'Unable to load timetables. Please try again.'}
              </p>
            )}
            {message && (
              <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-4">
                {message}
              </p>
            )}
            <section aria-label="Existing terms" className="space-y-4">
              {terms.isLoading ? (
                <p>Loading terms…</p>
              ) : !terms.data?.length ? (
                <p>No term timetables yet.</p>
              ) : (
                terms.data.map((term) => (
                  <article
                    key={term.term_id}
                    className="rounded-xl border border-grey-200 bg-white p-5"
                  >
                    <h2 className="text-xl font-semibold">{term.name}</h2>
                    <p>
                      {displayDate(term.start_date)} to {displayDate(term.end_date)} ·{' '}
                      {term.timezone}
                    </p>
                    <ul className="my-3 space-y-2">
                      {term.series.map((s) => (
                        <li
                          key={s.series_id}
                          className="flex flex-wrap items-center justify-between gap-2"
                        >
                          <span>
                            {s.definition.session_name}: {weekdays[s.definition.weekday]},{' '}
                            {s.definition.start_time} to {s.definition.end_time}
                          </span>
                          <Button
                            className="min-h-12"
                            variant="outline"
                            disabled={busy}
                            onClick={() => edit(term, s.series_id)}
                          >
                            Edit {s.definition.session_name}
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="min-h-12"
                      variant="outline"
                      disabled={busy}
                      onClick={() => rollover(term)}
                    >
                      Roll over {term.name}
                    </Button>
                  </article>
                ))
              )}
            </section>
            <section
              id="timetable-form"
              className="rounded-xl border border-grey-200 bg-white p-5 sm:p-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">
                  {editing
                    ? 'Edit recurring sessions'
                    : source
                      ? `Roll over ${source.name}`
                      : 'Create a term timetable'}
                </h2>
                {(editing || source) && (
                  <Button variant="outline" className="min-h-12" disabled={busy} onClick={startNew}>
                    Create a new timetable
                  </Button>
                )}
              </div>
              <form
                className="mt-6 space-y-6"
                onChange={() => {
                  setPreview(null);
                  save.reset();
                }}
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              >
                <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
                  {!editing && (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label>
                        Term name
                        <input className={control} {...form.register('name')} />
                      </label>
                      <label>
                        First date
                        <input type="date" className={control} {...form.register('start_date')} />
                      </label>
                      <label>
                        Last date
                        <input type="date" className={control} {...form.register('end_date')} />
                      </label>
                    </div>
                  )}
                  {editing && (
                    <div className="space-y-4">
                      <label className="block">
                        Session to change
                        <select
                          className={control}
                          value={occurrence}
                          onChange={(event) => {
                            chooseOccurrence(event.target.value);
                          }}
                        >
                          <option value="">Choose a session</option>
                          {sessions.data
                            ?.filter((s) => s.series_id === editing.seriesId)
                            .sort((a, b) => a.session_date.localeCompare(b.session_date))
                            .map((s) => (
                              <option key={s.session_id} value={s.session_id}>
                                {displayDate(s.session_date)} {s.start_time.slice(0, 5)} ({s.status}
                                {s.is_override ? ', individual override' : ''})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="block">
                        Apply changes to
                        <select
                          className={control}
                          value={scope}
                          onChange={(event) =>
                            chooseOccurrence(occurrence, event.target.value as 'one' | 'future')
                          }
                        >
                          <option value="one">This session only</option>
                          <option value="future">This and future sessions</option>
                        </select>
                      </label>
                      {scope === 'one' && (
                        <label className="block">
                          Move to date (optional)
                          <input
                            type="date"
                            className={control}
                            value={movedDate}
                            onChange={(event) => setMovedDate(event.target.value)}
                          />
                        </label>
                      )}
                      <p className="text-grey-600">
                        Past sessions, started sessions and recorded attendance are protected.
                        Future edits also preserve individual overrides. Dates use{' '}
                        {editing.term.timezone} local time.
                      </p>
                    </div>
                  )}
                  {fields.map((field, index) => (
                    <fieldset
                      key={field.id}
                      className="space-y-4 rounded-lg border border-grey-200 p-4"
                    >
                      <legend className="px-2 font-semibold">Weekly session {index + 1}</legend>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label>
                          Session name
                          <input
                            className={control}
                            readOnly={!!source}
                            {...form.register(`series.${index}.session_name`)}
                          />
                        </label>
                        <label>
                          Squad
                          <select
                            className={control}
                            disabled={!!source || !!editing}
                            {...form.register(`series.${index}.squad_id`)}
                          >
                            <option value="">Choose a squad</option>
                            {squads.data?.map((s) => (
                              <option key={s.squad_id} value={s.squad_id}>
                                {s.squad_name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Weekday
                          <select
                            className={control}
                            disabled={!!source || !!editing}
                            {...form.register(`series.${index}.weekday`)}
                          >
                            {weekdays.map((day, i) => (
                              <option key={day} value={i}>
                                {day}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Session capacity (optional)
                          <input
                            inputMode="numeric"
                            className={control}
                            readOnly={!!source}
                            {...form.register(`series.${index}.max_participants`)}
                          />
                        </label>
                        <label>
                          Start time
                          <input
                            type="time"
                            className={control}
                            readOnly={!!source}
                            {...form.register(`series.${index}.start_time`)}
                          />
                        </label>
                        <label>
                          End time
                          <input
                            type="time"
                            className={control}
                            readOnly={!!source}
                            {...form.register(`series.${index}.end_time`)}
                          />
                        </label>
                        <label>
                          Location
                          <input
                            className={control}
                            readOnly={!!source}
                            {...form.register(`series.${index}.location`)}
                          />
                        </label>
                        <label>
                          Coach
                          <input
                            className={control}
                            readOnly={!!source}
                            {...form.register(`series.${index}.coach_name`)}
                          />
                        </label>
                      </div>
                      <label className="block">
                        Notes
                        <textarea
                          className={control}
                          readOnly={!!source}
                          {...form.register(`series.${index}.description`)}
                        />
                      </label>
                      <label className="block">
                        Holiday or closure dates
                        <textarea
                          className={control}
                          placeholder="2027-02-15, 2027-02-22"
                          {...form.register(`series.${index}.excluded_dates`)}
                        />
                        <span className="text-sm text-grey-600">
                          Enter dates within this term as YYYY-MM-DD, separated by commas. These
                          dates stay visible as cancelled sessions.
                        </span>
                      </label>
                      {!editing && !source && fields.length > 1 && (
                        <Button
                          type="button"
                          className="min-h-12"
                          variant="outline"
                          onClick={() => remove(index)}
                        >
                          Remove weekly session {index + 1}
                        </Button>
                      )}
                    </fieldset>
                  ))}
                  {Object.keys(form.formState.errors).length > 0 && (
                    <p role="alert" className="text-red-700">
                      Check the term dates, squad, session name and times. Capacity must be a
                      positive whole number and holiday dates must use YYYY-MM-DD.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {!editing && !source && (
                      <Button
                        type="button"
                        className="min-h-12"
                        variant="outline"
                        disabled={fields.length >= 50}
                        onClick={() => append({ ...blankSlot })}
                      >
                        Add weekly session
                      </Button>
                    )}
                    <Button type="submit" className="min-h-12" disabled={busy}>
                      {busy ? 'Working…' : editing ? 'Save session changes' : 'Preview timetable'}
                    </Button>
                  </div>
                </fieldset>
              </form>
            </section>
            {preview && (
              <section
                aria-labelledby="preview-heading"
                className="space-y-4 rounded-xl border border-grey-200 bg-white p-6"
              >
                <h2 id="preview-heading" className="text-2xl font-semibold">
                  Review {preview.input.name}
                </h2>
                <p>
                  All times are local to {preview.result.timezone}. Places use current squad
                  membership, including all {MEMBER_NOUN_PLURAL.toLowerCase()} on the register. They
                  are not future reservations. No fees or enrolments will change.
                </p>
                {preview.result.rows.map((row, i) => (
                  <div key={i} className="rounded-lg border border-grey-200 p-4">
                    <h3 className="font-semibold">
                      {row.definition.session_name} · {row.squad_name}
                    </h3>
                    <p>
                      {row.scheduled.length} sessions, {row.dates.length - row.scheduled.length}{' '}
                      closures · {row.occupied} current places occupied · Capacity:{' '}
                      {row.capacity ?? 'Not set'} · Available: {row.places ?? 'Not limited'}
                    </p>
                    <details className="mt-2">
                      <summary className="min-h-12 cursor-pointer py-3">
                        Review all dates and times
                      </summary>
                      <ul>
                        {row.dates.map((d) => (
                          <li key={d}>
                            {displayDate(d)} · {row.definition.start_time} to{' '}
                            {row.definition.end_time}
                            {!row.scheduled.includes(d)
                              ? ' · Cancelled: holiday or club closure'
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                ))}
                {!preview.result.can_commit && (
                  <p role="alert">A squad exceeds capacity. Resolve this before saving.</p>
                )}
                <Button
                  className="min-h-12"
                  disabled={busy || !preview.result.can_commit}
                  onClick={() => save.mutate()}
                >
                  {save.isPending ? 'Saving…' : 'Confirm timetable'}
                </Button>
              </section>
            )}
          </>
        )}
      </main>
    </MainLayout>
  );
}
