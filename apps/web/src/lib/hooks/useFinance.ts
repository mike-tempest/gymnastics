'use client';

import {
  getFinanceDashboard,
  getInvoices,
  getOverdueInvoices,
  FinanceDashboard,
  InvoiceWithDetails,
} from '@/lib/api/finance';

import { useApi, UseApiResult } from './useApi';

export function useFinanceDashboard(): UseApiResult<FinanceDashboard> {
  return useApi(() => getFinanceDashboard(), []);
}

export function useInvoices(): UseApiResult<InvoiceWithDetails[]> {
  return useApi(() => getInvoices(), []);
}

export function useOverdueInvoices(): UseApiResult<InvoiceWithDetails[]> {
  return useApi(() => getOverdueInvoices(), []);
}
