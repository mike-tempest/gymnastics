export class KpiDto {
  value: number;
  label: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
}

export class RevenueStatsDto {
  totalRevenue: number;
  monthlyRevenue: number;
  outstandingAmount: number;
  collectionRate: number;
}

export class AttendanceStatsDto {
  totalSessions: number;
  averageAttendance: number;
  attendanceRate: number;
}

export class MembershipStatsDto {
  totalMembers: number;
  activeMembers: number;
  totalFamilies: number;
  totalSquads: number;
}

export class RecentActivityDto {
  id: string;
  type: 'invoice' | 'payment' | 'member' | 'session';
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class UpcomingSessionDto {
  session_id: string;
  squad_name: string;
  start_time: Date;
  end_time: Date;
  location: string | null;
  expected_attendees: number;
}

export class RevenueChartDataDto {
  month: string;
  revenue: number;
  invoiced: number;
  collected: number;
}

export class DashboardStatsDto {
  membership: MembershipStatsDto;
  revenue: RevenueStatsDto;
  attendance: AttendanceStatsDto;
  recentActivity: RecentActivityDto[];
  upcomingSessions: UpcomingSessionDto[];
  revenueChart: RevenueChartDataDto[];
}
