'use client';

import { getAdminDashboard, DashboardStats } from '@/lib/api/admin';
import { getAdminReports, AdminReportsData } from '@/lib/api/reports';

import { useApi, UseApiResult } from './useApi';

export function useAdminDashboard(): UseApiResult<DashboardStats> {
  return useApi(() => getAdminDashboard(), []);
}

export function useAdminReports(): UseApiResult<AdminReportsData> {
  return useApi(() => getAdminReports(), []);
}
