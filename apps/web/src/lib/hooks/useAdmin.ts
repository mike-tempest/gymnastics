'use client';

import { getAdminDashboard, DashboardStats } from '@/lib/api/admin';
import { getAdminReports, AdminReportsData } from '@/lib/api/reports';
import { getClubSettings, ClubSettingsData } from '@/lib/api/settings';

import { useApi, UseApiResult } from './useApi';

export function useAdminDashboard(): UseApiResult<DashboardStats> {
  return useApi(() => getAdminDashboard(), []);
}

export function useAdminReports(): UseApiResult<AdminReportsData> {
  return useApi(() => getAdminReports(), []);
}

export function useClubSettings(): UseApiResult<ClubSettingsData> {
  return useApi(() => getClubSettings(), []);
}
