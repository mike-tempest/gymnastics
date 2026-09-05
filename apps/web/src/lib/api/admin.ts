import { api } from './api-client';

export interface MembershipStats {
  totalMembers: number;
  activeMembers: number;
  totalFamilies: number;
  totalSquads: number;
}

export interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  outstandingAmount: number;
  collectionRate: number;
}

export interface AttendanceStats {
  totalSessions: number;
  averageAttendance: number;
  attendanceRate: number;
}

export interface RecentActivity {
  id: string;
  type: 'invoice' | 'payment' | 'member' | 'session';
  description: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface UpcomingSession {
  session_id: string;
  squad_name: string;
  start_time: string;
  end_time: string;
  location: string | null;
  expected_attendees: number;
}

export interface RevenueChartData {
  month: string;
  revenue: number;
  invoiced: number;
  collected: number;
}

export interface DashboardStats {
  membership: MembershipStats;
  revenue: RevenueStats;
  attendance: AttendanceStats;
  recentActivity: RecentActivity[];
  upcomingSessions: UpcomingSession[];
  revenueChart: RevenueChartData[];
}

export async function getAdminDashboard(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/admin/dashboard', { cache: 'no-store', credentials: 'include' });
}
