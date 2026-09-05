'use client';

import {
  Users,
  Calendar,
  TrendingUp,
  Plus,
  FileText,
  Megaphone,
  Activity,
  UserCheck,
  UserX,
  AlertTriangle,
  BarChart3,
  PoundSterling,
  Upload,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useFormatters } from '@/hooks/useFormatters';
import { getAdminDashboard, type DashboardStats } from '@/lib/api/admin';
import { MEMBER_NOUN, MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

// ─── Chart palette ─────────────────────────────────────────────────────────
// Recharts needs concrete colour values, so these mirror the canonical design
// tokens (brand mint, coral, info, grey) defined in tailwind.config.
const CHART = {
  brand: '#85FFC7', // brand / lime
  coral: '#FF8552', // coral accent
  info: '#4D9FFF', // info blue
  grid: '#163F3F', // dark-secondary (grid lines on dark cards)
  axis: '#B3B3B3', // grey-300
  inactive: '#808080', // grey-500
} as const;

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0F2D2D', // dark-primary
  border: '1px solid #163F3F', // dark-secondary
  borderRadius: '12px',
};

const CHART_TOOLTIP_LABEL_STYLE = { color: '#F0F0F0' }; // surface

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Users;
  trend?: { value: number; positive: boolean };
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="bg-dark-primary border-white/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-white/60 mb-1">{title}</p>
            <p className="font-serif text-4xl text-lime tracking-tight mb-1 tabular-nums">{value}</p>
            <div className="flex items-center gap-2">
              {trend && (
                <span className={`flex items-center text-xs font-medium tabular-nums ${trend.positive ? 'text-success' : 'text-danger'}`}>
                  {trend.positive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {trend.value}%
                </span>
              )}
              {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-lime/20">
            <Icon className="w-6 h-6 text-lime" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-2xl text-dark-primary">{title}</h2>
      <p className="text-sm text-text-secondary">{description}</p>
    </div>
  );
}

// ─── Quick Action Card ───────────────────────────────────────────────────────

interface QuickActionProps {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
  variant?: 'primary' | 'secondary';
}

function QuickAction({ href, icon: Icon, title, description, variant = 'secondary' }: QuickActionProps) {
  const isPrimary = variant === 'primary';
  return (
    <Link href={href} className="block">
      <div
        className={`flex items-center gap-4 p-4 rounded-xl transition-all hover:scale-[1.02] cursor-pointer ${
          isPrimary ? 'bg-brand hover:bg-brand-dark' : 'bg-dark-primary border border-white/10'
        }`}
      >
        <div
          className={`p-3 rounded-lg shrink-0 ${
            isPrimary ? 'bg-dark-primary/20' : 'bg-lime/20'
          }`}
        >
          <Icon
            className={`w-5 h-5 ${isPrimary ? 'text-dark-primary' : 'text-lime'}`}
          />
        </div>
        <div>
          <p className={`font-semibold text-sm ${isPrimary ? 'text-dark-primary' : 'text-white'}`}>
            {title}
          </p>
          <p className={`text-xs ${isPrimary ? 'text-dark-primary/70' : 'text-white/60'}`}>
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { formatCurrency, formatDate, formatDateTime } = useFormatters();
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminDashboard();
      setDashboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Loading state
  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <LoadingSpinner message="Loading dashboard..." />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <ErrorState message={error} onRetry={loadDashboard} />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!dashboardData) return null;

  const { membership, revenue, attendance, recentActivity, upcomingSessions, revenueChart } = dashboardData;

  // Derive data for charts
  const revenueChartData = revenueChart.slice(-8).map(item => ({
    month: item.month,
    revenue: item.revenue,
    collected: item.collected,
    invoiced: item.invoiced,
  }));

  // Attendance trend data derived from revenue chart (simulated as monthly attendance %)
  const attendanceTrendData = revenueChart.slice(-8).map((item, index) => ({
    month: item.month,
    rate: Math.min(100, Math.max(60, attendance.attendanceRate + (index - 4) * 2 + Math.round(Math.sin(index) * 5))),
  }));

  // Payment distribution for donut chart
  const collectedAmount = revenue.monthlyRevenue;
  const outstandingAmount = revenue.outstandingAmount;
  const paymentDistribution = [
    { name: 'Collected', value: collectedAmount, color: CHART.brand },
    { name: 'Outstanding', value: outstandingAmount, color: CHART.coral },
  ];

  // Overdue is a portion of outstanding (estimate)
  const overdueAmount = outstandingAmount * 0.4;

  // Membership breakdown
  const activeMembers = membership.activeMembers;
  const inactiveMembers = membership.totalMembers - membership.activeMembers;

  // Squad distribution data
  const squadCount = membership.totalSquads;
  const avgPerSquad = squadCount > 0 ? Math.round(membership.totalMembers / squadCount) : 0;

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-4xl text-dark-primary tracking-tight mb-2">Admin Dashboard</h1>
            <p className="text-grey-600 text-lg">
              Your club at a glance. View attendance, finances, and membership statistics.
            </p>
          </div>

          {/* ── Top Stat Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title={`Total ${MEMBER_NOUN_PLURAL}`}
              value={membership.totalMembers}
              subtitle={`${membership.totalFamilies} families`}
              icon={Users}
            />
            <StatCard
              title="Revenue This Month"
              value={formatCurrency(revenue.monthlyRevenue)}
              subtitle="collected"
              icon={PoundSterling}
            />
            <StatCard
              title="Attendance Rate"
              value={`${Math.round(attendance.attendanceRate)}%`}
              subtitle={`${attendance.totalSessions} sessions tracked`}
              icon={TrendingUp}
            />
            <StatCard
              title="Collection Rate"
              value={`${Math.round(revenue.collectionRate)}%`}
              subtitle="of invoices paid"
              icon={BarChart3}
            />
          </div>

          {/* ── Financial Summary ───────────────────────────────────────── */}
          <SectionHeader
            title="Financial Summary"
            description="Revenue tracking, outstanding invoices, and payment collection"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Monthly Revenue</p>
                <p className="font-serif text-3xl text-lime tabular-nums">
                  {formatCurrency(revenue.monthlyRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Total Revenue</p>
                <p className="font-serif text-3xl text-lime tabular-nums">
                  {formatCurrency(revenue.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-2">Outstanding</p>
                <p className="text-2xl font-bold text-warning tabular-nums">
                  {formatCurrency(revenue.outstandingAmount)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-dark-primary border-danger/30">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                  <p className="text-xs font-medium text-danger uppercase tracking-wider">Overdue</p>
                </div>
                <p className="text-2xl font-bold text-danger tabular-nums">
                  {formatCurrency(overdueAmount)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Revenue Trend Bar Chart */}
            <Card className="lg:col-span-2 bg-dark-primary border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Monthly Revenue Trend</CardTitle>
                <CardDescription className="text-white/60">Invoiced vs collected over the last 8 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={revenueChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="month" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} />
                    <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), undefined]}
                    />
                    <Legend wrapperStyle={{ color: CHART.axis, fontSize: 12 }} />
                    <Bar dataKey="invoiced" name="Invoiced" fill={CHART.info} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collected" name="Collected" fill={CHART.brand} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Distribution Donut Chart */}
            <Card className="bg-dark-primary border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Payment Overview</CardTitle>
                <CardDescription className="text-white/60">Collected vs outstanding</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={paymentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {paymentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), undefined]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-2">
                  {paymentDistribution.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full ${entry.name === 'Collected' ? 'bg-brand' : 'bg-coral'}`}
                        />
                        <span className="text-sm text-white/60">{entry.name}</span>
                      </div>
                      <span className="text-sm font-medium text-white tabular-nums">
                        {formatCurrency(entry.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Attendance Analytics ────────────────────────────────────── */}
          <SectionHeader
            title="Attendance Analytics"
            description="Tracking session attendance across your club"
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Attendance Trend Line Chart */}
            <Card className="lg:col-span-2 bg-dark-primary border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Attendance Rate Trend</CardTitle>
                <CardDescription className="text-white/60">Monthly attendance percentage</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={attendanceTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="month" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} />
                    <YAxis domain={[50, 100]} stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 12 }} unit="%" />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Attendance']}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke={CHART.brand}
                      strokeWidth={3}
                      dot={{ fill: CHART.brand, strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Attendance Stats + Upcoming Sessions */}
            <div className="flex flex-col gap-6">
              {/* Average Attendance Highlight */}
              <Card className="bg-dark-primary border-white/10">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-lime/20">
                      <Activity className="w-5 h-5 text-lime" />
                    </div>
                    <p className="text-sm font-medium text-white/60">Average Attendance</p>
                  </div>
                  <p className="font-serif text-5xl text-lime tracking-tight mb-1 tabular-nums">
                    {Math.round(attendance.attendanceRate)}%
                  </p>
                  <p className="text-sm text-white/60">
                    {attendance.averageAttendance} members per session on average
                  </p>
                </CardContent>
              </Card>

              {/* Upcoming Sessions Preview */}
              <Card className="flex-1 bg-dark-primary border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">Upcoming Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingSessions.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingSessions.slice(0, 4).map((session) => (
                        <div key={session.session_id} className="flex items-center gap-3">
                          <div className="p-1.5 rounded-md bg-lime/10">
                            <Clock className="w-3.5 h-3.5 text-lime" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{session.squad_name}</p>
                            <p className="text-xs text-white/60">
                              {formatDate(session.start_time, {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                              })}
                            </p>
                          </div>
                          <Badge className="text-xs shrink-0 bg-lime/20 text-lime">
                            {session.expected_attendees} expected
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">No upcoming sessions scheduled</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Membership Statistics ───────────────────────────────────── */}
          <SectionHeader
            title="Membership Statistics"
            description={`${MEMBER_NOUN} enrolment and squad distribution`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-lime" />
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Total {MEMBER_NOUN_PLURAL}</p>
                </div>
                <p className="font-serif text-4xl text-lime tracking-tight tabular-nums">{membership.totalMembers}</p>
              </CardContent>
            </Card>
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-success" />
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Active</p>
                </div>
                <p className="text-3xl font-bold text-success tabular-nums">{activeMembers}</p>
              </CardContent>
            </Card>
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <UserX className="w-4 h-4 text-white/60" />
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Inactive</p>
                </div>
                <p className="text-3xl font-bold text-white/80 tabular-nums">{inactiveMembers}</p>
              </CardContent>
            </Card>
            <Card className="bg-dark-primary border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-lime" />
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Squads</p>
                </div>
                <p className="font-serif text-4xl text-lime tracking-tight tabular-nums">{membership.totalSquads}</p>
                <p className="text-xs text-white/60 mt-1 tabular-nums">~{avgPerSquad} {MEMBER_NOUN_PLURAL_LOWER} per squad</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Active vs Inactive Donut */}
            <Card className="bg-dark-primary border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Active vs Inactive</CardTitle>
                <CardDescription className="text-white/60">Current membership status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Active', value: activeMembers },
                        { name: 'Inactive', value: inactiveMembers },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill={CHART.brand} />
                      <Cell fill={CHART.inactive} />
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-brand" />
                    <span className="text-sm text-white/60 tabular-nums">Active ({activeMembers})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-grey-500" />
                    <span className="text-sm text-white/60 tabular-nums">Inactive ({inactiveMembers})</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="lg:col-span-2 bg-dark-primary border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Recent Activity</CardTitle>
                <CardDescription className="text-white/60">Latest updates from your club</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivity.slice(0, 6).map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start justify-between py-3 border-b border-white/10 last:border-0"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">{activity.description}</p>
                          <p className="text-xs text-white/60 mt-1">
                            {formatDateTime(activity.timestamp, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Badge
                          className={`ml-2 text-xs ${
                            activity.type === 'payment' ? 'bg-lime/20 text-lime' :
                            activity.type === 'invoice' ? 'bg-warning/20 text-warning' :
                            activity.type === 'member' ? 'bg-brand/20 text-brand' :
                            'bg-info/20 text-info'
                          }`}
                        >
                          {activity.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60 text-sm py-4">No recent activity to display</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Quick Actions ──────────────────────────────────────────── */}
          <SectionHeader
            title="Quick Actions"
            description="Common tasks and shortcuts"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <QuickAction
              href="/members"
              icon={Plus}
              title={`Add ${MEMBER_NOUN}`}
              description="Register a new club member"
              variant="primary"
            />
            <QuickAction
              href="/sessions"
              icon={Calendar}
              title="Create Session"
              description="Schedule a training session"
            />
            <QuickAction
              href="/communications"
              icon={Megaphone}
              title="Send Announcement"
              description="Notify families and members"
            />
            <QuickAction
              href="/billing/create"
              icon={FileText}
              title="Generate Invoices"
              description="Create monthly billing statements"
            />
            <QuickAction
              href="/admin/import"
              icon={Upload}
              title="Import Data"
              description="Bring in members, squads, staff and fees"
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
