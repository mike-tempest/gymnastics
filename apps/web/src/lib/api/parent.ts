import {
  Swimmer,
  Session,
  Family,
  Payment,
  InvoiceStatus,
  Attendance,
  AttendanceStats,
} from '@swim-nexus/shared-types';

import { api, apiDownload } from './api-client';
import { type CompetitionResult, type SwimmerPersonalBests } from './competitions';
import { InvoiceWithDetails } from './finance';

// Parent profile and family

export interface ParentProfile {
  family: Family;
  swimmers: Swimmer[];
}

export interface ParentDashboardSummary {
  childrenCount: number;
  upcomingSessions: Session[];
  outstandingInvoices: InvoiceWithDetails[];
  totalOutstanding: number;
}

// Parent profile

export async function getParentProfile(): Promise<ParentProfile> {
  return api.get<ParentProfile>('/parent/profile', { cache: 'no-store' });
}

export interface UpdateParentProfileData {
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

export async function updateParentProfile(data: UpdateParentProfileData): Promise<Family> {
  return api.patch<Family>('/parent/profile', data);
}

// Swimmers (children in backend terminology)

export async function fetchParentSwimmers(): Promise<Swimmer[]> {
  return api.get<Swimmer[]>('/parent/children', { cache: 'no-store' });
}

export async function fetchParentSwimmer(swimmerId: string): Promise<Swimmer> {
  return api.get<Swimmer>(`/parent/children/${swimmerId}`, { cache: 'no-store' });
}

// Sessions
// No backend endpoint exists yet for /parent/sessions.

export async function fetchParentUpcomingSessions(): Promise<Session[]> {
  return api.get<Session[]>('/parent/sessions/upcoming', { cache: 'no-store' });
}

export async function fetchSwimmerSchedule(swimmerId: string): Promise<Session[]> {
  return api.get<Session[]>(`/parent/children/${swimmerId}/schedule`, { cache: 'no-store' });
}

// Times and personal bests

export async function fetchSwimmerResults(swimmerId: string): Promise<CompetitionResult[]> {
  return api.get<CompetitionResult[]>(`/parent/children/${swimmerId}/results`, { cache: 'no-store' });
}

export async function fetchSwimmerPersonalBests(swimmerId: string): Promise<SwimmerPersonalBests> {
  return api.get<SwimmerPersonalBests>(`/parent/children/${swimmerId}/personal-bests`, {
    cache: 'no-store',
  });
}

// Attendance

export async function fetchSwimmerAttendanceHistory(swimmerId: string): Promise<Attendance[]> {
  return api.get<Attendance[]>(`/attendance/swimmer/${swimmerId}`, { cache: 'no-store' });
}

export async function fetchSwimmerAttendanceStats(swimmerId: string): Promise<AttendanceStats> {
  return api.get<AttendanceStats>(`/attendance/swimmer/${swimmerId}/stats`, { cache: 'no-store' });
}

// Invoices
// No backend endpoint exists yet for /parent/invoices.

export async function fetchParentInvoices(status?: InvoiceStatus): Promise<InvoiceWithDetails[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  const query = params.toString();
  const path = `/parent/invoices${query ? `?${query}` : ''}`;
  return api.get<InvoiceWithDetails[]>(path, { cache: 'no-store' });
}

export async function fetchParentInvoice(invoiceId: string): Promise<InvoiceWithDetails> {
  return api.get<InvoiceWithDetails>(`/parent/invoices/${invoiceId}`, { cache: 'no-store' });
}

export async function downloadParentInvoicePdf(invoiceId: string): Promise<void> {
  // The server names the file (tax-invoice-<number>.pdf for Australian tax
  // invoices) via Content-Disposition; the fallback only covers header loss.
  return apiDownload(`/parent/invoices/${invoiceId}/pdf`, `invoice-${invoiceId}.pdf`);
}

export async function fetchParentPayments(): Promise<Payment[]> {
  return api.get<Payment[]>('/parent/payments', { cache: 'no-store' });
}

// Dashboard

export async function fetchParentDashboard(): Promise<ParentDashboardSummary> {
  return api.get<ParentDashboardSummary>('/parent/dashboard', { cache: 'no-store' });
}
