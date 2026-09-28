import { api, apiDownload } from './api-client';

export type ReportMetric = 'occupancy' | 'offers' | 'invoiced' | 'collected';
export interface ReportFilters {
  from?: string;
  to?: string;
  squad_id?: string;
  discipline?: string;
}
interface Money {
  status: 'available' | 'unavailable';
  reason?: string;
  definition?: string;
  totals?: { currency: string; minor_units: string; count: number }[];
}
export interface OperationalReport {
  definition_version: string;
  observed_at: string;
  timezone: string;
  from: string;
  to: string;
  occupancy: {
    assigned: number;
    capacity: number;
    rate_percent: number | null;
    reserved: number;
    unknown_capacity_classes: number;
    assigned_without_capacity: number;
    class_count: number;
    definition: string;
  };
  offers: {
    issued: number;
    accepted: number;
    resolved: number;
    declined: number;
    expired: number;
    withdrawn: number;
    pending: number;
    rate_percent: number | null;
    resolved_rate_percent: number | null;
    definition: string;
  };
  invoiced: Money;
  collected: Money;
  unavailable: {
    id: string;
    label: string;
    reason: string;
    definition: string;
    first_supported_date: null;
  }[];
}
export interface ReportRecords {
  total: number;
  page: number;
  observed_at: string;
  rows: {
    id: string;
    label: string;
    detail: string;
    href: string;
    minor_units?: string;
    currency?: string;
  }[];
}
function query(filters: ReportFilters, metric?: ReportMetric, page?: number) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (metric) params.set('metric', metric);
  if (page) params.set('page', String(page));
  return params.toString();
}
export const getOperationalReport = (filters: ReportFilters) =>
  api.get<OperationalReport>(`/admin/reports/operations?${query(filters)}`, { cache: 'no-store' });
export const getReportRecords = (filters: ReportFilters, metric: ReportMetric, page: number) =>
  api.get<ReportRecords>(`/admin/reports/operations/records?${query(filters, metric, page)}`, {
    cache: 'no-store',
  });
export const downloadReport = (filters: ReportFilters, metric: ReportMetric) =>
  apiDownload(
    `/admin/reports/operations/export.csv?${query(filters, metric)}`,
    `operational-${metric}.csv`
  );
export function formatReportMoney(minor: string, currency: string) {
  const amount = BigInt(minor);
  const absolute = amount < BigInt(0) ? -amount : amount;
  return `${currency} ${amount < BigInt(0) ? '-' : ''}${(absolute / BigInt(100)).toLocaleString('en-GB')}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}
