import { api } from './api-client';

export interface WeeklyAttendanceTrend {
  label: string;
  rate: number;
}

export interface SquadAttendanceRate {
  squadId: string;
  squadName: string;
  attendanceRate: number;
}

export interface TopAbsentee {
  memberId: string;
  name: string;
  squadName: string;
  missedCount: number;
}

export interface NewJoiner {
  memberId: string;
  name: string;
  squadName: string;
  joinedAt: string;
}

export interface Leaver {
  memberId: string;
  name: string;
  squadName: string;
  leftAt: string;
}

export interface SquadDistributionItem {
  squadId: string;
  squadName: string;
  memberCount: number;
}

export interface AdminReportsData {
  weeklyAttendanceTrend: WeeklyAttendanceTrend[];
  squadAttendanceRates: SquadAttendanceRate[];
  topAbsentees: TopAbsentee[];
  newJoiners: NewJoiner[];
  leavers: Leaver[];
  squadDistribution: SquadDistributionItem[];
}

export async function getAdminReports(): Promise<AdminReportsData> {
  return api.get<AdminReportsData>('/admin/reports', { cache: 'no-store' });
}
