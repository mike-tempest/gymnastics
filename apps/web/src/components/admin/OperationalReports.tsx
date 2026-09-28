'use client';

import { DISCIPLINE_LABELS } from '@club-manager/shared-types';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  downloadReport,
  formatReportMoney,
  getOperationalReport,
  getReportRecords,
  ReportFilters,
  ReportMetric,
} from '@/lib/api/operational-reports';
import { getSquads } from '@/lib/api/squads';

const formSchema = z
  .object({ from: z.string(), to: z.string(), squad_id: z.string(), discipline: z.string() })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: 'The end date must follow the start date.',
    path: ['to'],
  });
const titles: Record<ReportMetric, string> = {
  occupancy: 'Current class occupancy',
  offers: 'Offer acceptance',
  invoiced: 'Gross invoiced',
  collected: 'Gross confirmed collections',
};
const percent = (value: number | null) => (value === null ? 'No eligible data' : `${value}%`);
export default function OperationalReports() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [metric, setMetric] = useState<ReportMetric>('occupancy');
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { from: '', to: '', squad_id: '', discipline: '' },
  });
  const squads = useQuery({ queryKey: ['squads'], queryFn: () => getSquads() });
  const summary = useQuery({
    queryKey: ['operational-report', filters],
    queryFn: () => getOperationalReport(filters),
    staleTime: 0,
  });
  const financiallyFiltered =
    !!(filters.squad_id || filters.discipline) && (metric === 'invoiced' || metric === 'collected');
  const records = useQuery({
    queryKey: ['operational-records', filters, metric, page],
    queryFn: () => getReportRecords(filters, metric, page),
    enabled: !!summary.data && !financiallyFiltered,
    staleTime: 0,
  });
  const data = summary.data;
  async function exportRows() {
    setExporting(true);
    setExportError('');
    try {
      await downloadReport(filters, metric);
    } catch {
      setExportError(
        'Export failed. Please retry, or narrow the filters to fewer than 10,000 records.'
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <section
      aria-labelledby="operational-heading"
      className="mb-8 space-y-5 rounded-xl border border-grey-200 bg-white p-6 text-text-primary"
    >
      <h2 id="operational-heading" className="text-2xl font-semibold">
        Operational reports
      </h2>
      <p>
        Current class capacity, issued offers and recorded finances. Each measure states its
        coverage. Historical figures remain unavailable until their source records exist.
      </p>
      <form
        onSubmit={form.handleSubmit((values) => {
          setFilters(values);
          setPage(1);
          setExportError('');
        })}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-sm">
          From
          <input
            type="date"
            {...form.register('from')}
            className="mt-1 min-h-12 w-full rounded border border-grey-300 p-2"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            {...form.register('to')}
            className="mt-1 min-h-12 w-full rounded border border-grey-300 p-2"
          />
        </label>
        <label className="text-sm">
          Class
          <select
            {...form.register('squad_id')}
            className="mt-1 min-h-12 w-full rounded border border-grey-300 p-2"
          >
            <option value="">All classes</option>
            {squads.data?.map((squad) => (
              <option key={squad.squad_id} value={squad.squad_id}>
                {squad.squad_name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Discipline
          <select
            {...form.register('discipline')}
            className="mt-1 min-h-12 w-full rounded border border-grey-300 p-2"
          >
            <option value="">All disciplines</option>
            {Object.entries(DISCIPLINE_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-12 self-end">
          Apply filters
        </Button>
        {form.formState.errors.to && <p role="alert">{form.formState.errors.to.message}</p>}
      </form>
      <p className="text-sm text-grey-600">
        Blank dates use the current month in your club’s time zone. Date filters apply to offers and
        money, not current occupancy.
      </p>
      {squads.isError && (
        <p role="alert">
          The class list could not be loaded.{' '}
          <Button variant="outline" onClick={() => squads.refetch()}>
            Retry classes
          </Button>
        </p>
      )}
      {summary.isPending && <p role="status">Loading reports…</p>}
      {summary.isError && (
        <p role="alert">
          Reports could not be loaded. These are not zero results.{' '}
          <Button onClick={() => summary.refetch()}>Retry reports</Button>
        </p>
      )}
      {data && !summary.isError && (
        <>
          <p className="text-sm text-grey-600">
            {data.from} to {data.to}, inclusive ({data.timezone}). Observed{' '}
            {new Date(data.observed_at).toLocaleString('en-GB', { timeZone: data.timezone })}.
            Definition {data.definition_version}.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded border border-grey-200 p-4">
              <h3 className="font-semibold">{titles.occupancy}</h3>
              <p className="text-2xl">{percent(data.occupancy.rate_percent)}</p>
              <p>
                {data.occupancy.assigned} assigned / {data.occupancy.capacity} usable places;{' '}
                {data.occupancy.reserved} pending reservations.
              </p>
              <p>
                {data.occupancy.unknown_capacity_classes} classes have no usable capacity recorded (
                {data.occupancy.assigned_without_capacity} assigned places excluded from the rate).
              </p>
              <p className="mt-2 text-sm text-grey-600">{data.occupancy.definition}</p>
            </article>
            <article className="rounded border border-grey-200 p-4">
              <h3 className="font-semibold">{titles.offers}</h3>
              <p className="text-2xl">{percent(data.offers.rate_percent)}</p>
              <p>
                {data.offers.accepted} accepted / {data.offers.issued} issued. Resolved acceptance:{' '}
                {percent(data.offers.resolved_rate_percent)} ({data.offers.accepted}/
                {data.offers.resolved}).
              </p>
              <p>
                {data.offers.pending} pending; {data.offers.declined} declined;{' '}
                {data.offers.expired} expired; {data.offers.withdrawn} withdrawn.
              </p>
              <p className="mt-2 text-sm text-grey-600">{data.offers.definition}</p>
            </article>
            {(['invoiced', 'collected'] as const).map((key) => (
              <article key={key} className="rounded border border-grey-200 p-4">
                <h3 className="font-semibold">{titles[key]}</h3>
                {data[key].status === 'unavailable' ? (
                  <p>Unavailable: {data[key].reason}</p>
                ) : (
                  <>
                    <p>
                      {data[key].totals?.length
                        ? data[key].totals
                            ?.map(
                              (total) =>
                                `${formatReportMoney(total.minor_units, total.currency)} (${total.count} records)`
                            )
                            .join('; ')
                        : 'No eligible financial records in this period.'}
                    </p>
                    <p className="mt-2 text-sm text-grey-600">{data[key].definition}</p>
                  </>
                )}
              </article>
            ))}
          </div>
          <details className="rounded border border-grey-200 p-4">
            <summary className="min-h-12 cursor-pointer font-semibold">
              Measures not yet available
            </summary>
            <div className="space-y-4">
              {data.unavailable.map((item) => (
                <div key={item.id}>
                  <h3 className="font-semibold">{item.label}: unavailable</h3>
                  <p>{item.reason}</p>
                  <p className="text-sm text-grey-600">
                    {item.definition} No supported historical start date.
                  </p>
                </div>
              ))}
            </div>
          </details>
          <div className="flex flex-wrap items-end gap-4">
            <label>
              Records
              <select
                value={metric}
                onChange={(event) => {
                  setMetric(event.target.value as ReportMetric);
                  setPage(1);
                  setExportError('');
                }}
                className="ml-2 min-h-12 rounded border border-grey-300 p-2"
              >
                {Object.entries(titles).map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="min-h-12"
              disabled={exporting || financiallyFiltered || records.isError || !records.data}
              onClick={exportRows}
            >
              {exporting ? 'Exporting…' : 'Export these records'}
            </Button>
          </div>
          <p className="text-sm text-grey-600">
            Records and exports use the same filters. Each request observes the latest committed
            data; changes between requests can change totals.
          </p>
          {exportError && <p role="alert">{exportError}</p>}
          {financiallyFiltered ? (
            <p>
              Class allocation is unavailable for family finances. Clear class and discipline
              filters to view financial records.
            </p>
          ) : records.isError ? (
            <p role="alert">
              Records could not be loaded.{' '}
              <Button onClick={() => records.refetch()}>Retry records</Button>
            </p>
          ) : records.isPending ? (
            <p role="status">Loading records…</p>
          ) : (
            records.data && (
              <>
                <p>{records.data.total} matching records</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Record</th>
                        <th className="p-2">Details</th>
                        <th className="p-2">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.data.rows.map((row) => (
                        <tr key={row.id} className="border-t border-grey-200">
                          <td className="p-2">
                            <Link
                              href={row.href}
                              className="inline-flex min-h-12 items-center underline"
                            >
                              {row.label}
                            </Link>
                          </td>
                          <td className="p-2">{row.detail}</td>
                          <td className="p-2">
                            {row.minor_units !== undefined && row.currency
                              ? formatReportMoney(row.minor_units, row.currency)
                              : 'Not applicable'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="min-h-12"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} of {Math.max(1, Math.ceil(records.data.total / 100))}
                  </span>
                  <Button
                    variant="outline"
                    className="min-h-12"
                    disabled={page * 100 >= records.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )
          )}
        </>
      )}
    </section>
  );
}
