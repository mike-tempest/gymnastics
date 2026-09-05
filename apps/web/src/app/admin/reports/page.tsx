'use client';

import { InvoiceStatus } from '@swim-nexus/shared-types';
import {
  BarChart3,
  Download,
  Printer,
  Users,
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  PoundSterling,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import MainLayout from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useFormatters } from '@/hooks/useFormatters';
import { getAdminDashboard, type DashboardStats } from '@/lib/api/admin';
import { getInvoices, type InvoiceWithDetails } from '@/lib/api/finance';
import { getAdminReports, type AdminReportsData } from '@/lib/api/reports';

// ---------------------------------------------------------------------------
// Colour palette for squads
// These mirror the canonical design tokens (brand, info, coral, teal, etc.)
// defined in tailwind.config. Recharts-style inline fills need concrete values.
// ---------------------------------------------------------------------------
const SQUAD_COLOURS = ['#85FFC7', '#4D9FFF', '#FF8552', '#3A9E9E', '#B2FFE0', '#FFB020', '#5CEFAA'];

function getSquadColour(index: number): string {
  return SQUAD_COLOURS[index % SQUAD_COLOURS.length];
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Users;
}) {
  return (
    <Card className="bg-dark-primary border-white/10">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-white/60 mb-1">{title}</p>
            <p className="font-serif text-4xl text-lime tracking-tight mb-2 tabular-nums">
              {value}
            </p>
            {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-lg bg-lime/20">
            <Icon className="w-6 h-6 text-lime" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { formatDate } = useFormatters();
  const { club } = useClubRegion();
  // Print headers show the club's own name; while the club has not loaded
  // (or the fetch failed) they omit the name rather than printing the
  // platform placeholder as if it were the club.
  const clubDisplayName = club?.name ?? '';
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<AdminReportsData | null>(null);
  const [pendingInvoices, setPendingInvoices] = useState<InvoiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashboardData, reportsData, invoicesData] = await Promise.all([
        getAdminDashboard(),
        getAdminReports(),
        getInvoices({ status: InvoiceStatus.PENDING }),
      ]);
      setDashboard(dashboardData);
      setReports(reportsData);
      setPendingInvoices(invoicesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <LoadingSpinner message="Loading reports..." />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="min-h-dvh bg-canvas p-6 sm:p-10">
          <div className="max-w-7xl mx-auto">
            <ErrorState message={error} onRetry={loadData} />
          </div>
        </div>
      </MainLayout>
    );
  }

  // Safely extract data with fallbacks
  const weeklyAttendance = reports?.weeklyAttendanceTrend ?? [];
  const squadAttendanceRates = reports?.squadAttendanceRates ?? [];
  const topAbsentees = reports?.topAbsentees ?? [];
  const newJoiners = reports?.newJoiners ?? [];
  const leavers = reports?.leavers ?? [];
  const squadDistribution = reports?.squadDistribution ?? [];

  const revenueChart = dashboard?.revenueChart ?? [];
  const activeSwimmers = dashboard?.membership?.activeSwimmers ?? 0;
  const collectionRate = Math.round(dashboard?.revenue?.collectionRate ?? 0);

  // Monthly revenue chart data mapped to { month, amount }
  const monthlyRevenue = revenueChart.map((r) => ({
    month: r.month,
    amount: r.collected,
  }));
  const maxRevenue =
    monthlyRevenue.length > 0 ? Math.max(...monthlyRevenue.map((m) => m.amount)) : 1;

  const totalOutstanding = pendingInvoices.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0);

  const totalDistribution = squadDistribution.reduce((sum, s) => sum + s.swimmerCount, 0);

  // Average attendance from the weekly trend
  const avgAttendance =
    weeklyAttendance.length > 0
      ? Math.round(weeklyAttendance.reduce((sum, w) => sum + w.rate, 0) / weeklyAttendance.length)
      : 0;

  // Latest month revenue
  const latestMonthRevenue =
    monthlyRevenue.length > 0 ? monthlyRevenue[monthlyRevenue.length - 1].amount : 0;
  const latestMonthLabel =
    monthlyRevenue.length > 0 ? monthlyRevenue[monthlyRevenue.length - 1].month : '';

  return (
    <MainLayout>
      {/* Print styles for reports page */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          .reports-page {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            min-height: auto !important;
          }
          .reports-page * {
            color: black !important;
          }
          .reports-page .max-w-7xl {
            max-width: none !important;
          }
          .reports-page .no-print {
            display: none !important;
          }
          .reports-page .print-only {
            display: block !important;
          }

          /* ---- Print header ---- */
          .reports-print-header {
            display: block !important;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 2px solid black;
          }
          .reports-print-header h1 {
            font-size: 1.5rem;
            font-weight: bold;
            color: black !important;
            margin: 0 0 0.125rem;
          }
          .reports-print-header p {
            font-size: 0.8125rem;
            color: #333 !important;
            margin: 0;
          }
          .reports-print-header .print-header-meta {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-top: 0.25rem;
            font-size: 0.75rem;
            color: #555 !important;
          }

          /* ---- Screen header: compact for print ---- */
          .reports-page h1 {
            font-size: 1.25rem !important;
            margin-bottom: 0.25rem !important;
          }
          .reports-page > .max-w-7xl > .flex:first-child > div > p {
            display: none !important;
          }

          /* ---- Section headings ---- */
          .reports-page h2 {
            font-size: 1.125rem !important;
            margin-top: 0.5rem !important;
            margin-bottom: 0.5rem !important;
            padding-bottom: 0.25rem;
            border-bottom: 1.5px solid #333;
          }
          .reports-page h2 svg {
            display: none !important;
          }

          /* ---- Stat cards: compact row layout ---- */
          .report-stat-cards {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 0.75rem !important;
            margin-bottom: 1rem !important;
          }
          .report-stat-cards > * {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            background: white !important;
            border: 1px solid #999 !important;
            padding: 0.5rem 0.75rem !important;
            border-radius: 4px !important;
            break-inside: avoid;
          }
          .report-stat-cards [class*="CardContent"] {
            padding: 0.5rem !important;
          }
          .report-stat-cards .p-3 {
            display: none !important;
          }
          .report-stat-cards p.text-3xl {
            font-size: 1.25rem !important;
          }

          /* ---- Hide charts, show print-only summaries ---- */
          .report-chart {
            display: none !important;
          }
          .report-chart-summary {
            display: block !important;
            margin-bottom: 0.75rem;
            break-inside: avoid;
          }
          .report-chart-summary p {
            font-weight: 600;
            margin-bottom: 0.25rem;
            font-size: 0.875rem;
          }
          .report-chart-summary table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8125rem;
          }
          .report-chart-summary th,
          .report-chart-summary td {
            border: 1px solid #666;
            padding: 5px 8px;
            text-align: left;
          }
          .report-chart-summary th {
            background-color: #e5e5e5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-weight: 600;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }

          /* ---- Tables inside cards ---- */
          .reports-page table {
            border-collapse: collapse;
          }
          .reports-page table th,
          .reports-page table td {
            border: 1px solid #bbb !important;
            padding: 5px 8px !important;
            font-size: 0.8125rem;
          }
          .reports-page table th {
            font-weight: 600 !important;
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .reports-page table tbody tr:nth-child(even) {
            background-color: #f9f9f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* ---- Cards: flatten for print ---- */
          .reports-page [class*="Card"] {
            background: white !important;
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            break-inside: avoid;
          }

          /* ---- Grid: single column for print ---- */
          .reports-page .grid {
            display: block !important;
          }
          .reports-page .grid > * {
            margin-bottom: 0.75rem !important;
          }

          /* ---- Badge styling ---- */
          .reports-page [class*="Badge"] {
            border: 1px solid #999 !important;
            background: white !important;
            font-size: 0.75rem !important;
          }

          /* ---- Remove coloured progress bars ---- */
          .report-progress-bar {
            display: none !important;
          }

          /* ---- Squad colour dots: show as black in print ---- */
          .reports-page .w-3.h-3.rounded-full {
            background-color: #333 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* ---- Section page breaks ---- */
          .report-section {
            break-inside: avoid;
          }
          .report-section-break {
            break-before: page;
          }

          /* ---- Trend icons: hide in print ---- */
          .report-trend-icon {
            display: none !important;
          }

          /* ---- Print footer ---- */
          .reports-print-footer {
            display: block !important;
            margin-top: 1.5rem;
            padding-top: 0.5rem;
            border-top: 1.5px solid #333;
            font-size: 0.6875rem;
            color: #666 !important;
          }
          .reports-print-footer .print-footer-inner {
            display: flex;
            justify-content: space-between;
          }
        }
      `,
        }}
      />
      <div className="reports-page min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Print-only header */}
          <div className="reports-print-header hidden">
            <h1>Reports and Analytics</h1>
            <p>{clubDisplayName ? `${clubDisplayName}, Committee Report` : 'Committee Report'}</p>
            <div className="print-header-meta">
              <span>
                Generated{' '}
                {formatDate(new Date(), {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span>Confidential</span>
            </div>
          </div>

          {/* Screen header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4 no-print">
            <div>
              <h1 className="font-serif text-4xl text-dark-primary tracking-tight mb-2">
                Reports and Analytics
              </h1>
              <p className="text-grey-600 text-lg">
                A comprehensive overview of attendance, finances, and membership across your club.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button className="flex items-center gap-2 bg-brand text-dark-primary hover:bg-brand-dark">
                <Download className="w-4 h-4" />
                Download CSV
              </Button>
              <Button
                onClick={() => window.print()}
                className="flex items-center gap-2"
                variant="outline"
              >
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
          </div>

          {/* Top-level stat cards */}
          <div className="report-stat-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Active Swimmers"
              value={activeSwimmers}
              subtitle={`${newJoiners.length} new this month`}
              icon={Users}
            />
            <StatCard
              title="Avg Attendance Rate"
              value={`${avgAttendance}%`}
              subtitle="Last 8 weeks"
              icon={Calendar}
            />
            <StatCard
              title="Monthly Revenue"
              value={`\u00A3${latestMonthRevenue.toLocaleString()}`}
              subtitle={latestMonthLabel}
              icon={PoundSterling}
            />
            <StatCard
              title="Collection Rate"
              value={`${collectionRate}%`}
              subtitle={`${pendingInvoices.length} invoices outstanding`}
              icon={CheckCircle2}
            />
          </div>

          {/* ================================================================
              ATTENDANCE SECTION
              ================================================================ */}
          <div className="mb-8 report-section">
            <h2 className="font-serif text-2xl text-dark-primary mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-lime" />
              Attendance Report
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly trend bar chart (hidden in print) */}
              <Card className="report-chart bg-dark-primary border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Weekly Attendance Trend</CardTitle>
                  <CardDescription className="text-white/60">
                    Average attendance rate per week (last 8 weeks)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-2 h-[200px]">
                    {weeklyAttendance.map((week) => (
                      <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-white/60 tabular-nums">{week.rate}%</span>
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-lime to-lime-light"
                          style={{ height: `${(week.rate / 100) * 160}px` }}
                        />
                        <span className="text-xs text-white/70 mt-1">{week.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Print-only: weekly attendance table */}
              <div className="report-chart-summary hidden">
                <p className="font-semibold mb-1">Weekly Attendance Trend (last 8 weeks)</p>
                <table>
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyAttendance.map((week) => (
                      <tr key={week.label}>
                        <td>{week.label}</td>
                        <td>{week.rate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Attendance by squad (hidden in print) */}
              <Card className="report-chart bg-dark-primary border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Attendance by Squad</CardTitle>
                  <CardDescription className="text-white/60">
                    Current monthly attendance rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {squadAttendanceRates.map((squad, index) => (
                      <div key={squad.squadId}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white/80">{squad.squadName}</span>
                          <span className="text-sm font-semibold text-white tabular-nums">
                            {squad.attendanceRate}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${squad.attendanceRate}%`,
                              backgroundColor: getSquadColour(index),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Print-only: squad attendance table */}
              <div className="report-chart-summary hidden">
                <p className="font-semibold mb-1">Attendance by Squad</p>
                <table>
                  <thead>
                    <tr>
                      <th>Squad</th>
                      <th>Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {squadAttendanceRates.map((squad) => (
                      <tr key={squad.squadId}>
                        <td>{squad.squadName}</td>
                        <td>{squad.attendanceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top absentees */}
              <Card className="lg:col-span-2 bg-dark-primary border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Top Absentees</CardTitle>
                  <CardDescription className="text-white/60">
                    Swimmers with the most missed sessions this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topAbsentees.length === 0 ? (
                    <p className="text-sm text-white/70">No absences recorded this month.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="pb-3 text-sm font-medium text-white/60">Swimmer</th>
                            <th className="pb-3 text-sm font-medium text-white/60">Squad</th>
                            <th className="pb-3 text-sm font-medium text-white/60 text-right">
                              Missed Sessions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {topAbsentees.map((swimmer) => (
                            <tr
                              key={swimmer.swimmerId}
                              className="border-b border-white/10 last:border-0"
                            >
                              <td className="py-3 text-sm text-white">{swimmer.name}</td>
                              <td className="py-3">
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-white/10 text-white/60"
                                >
                                  {swimmer.squadName}
                                </Badge>
                              </td>
                              <td className="py-3 text-sm font-semibold text-right">
                                <span
                                  className={`inline-flex items-center gap-1 tabular-nums ${swimmer.missedCount >= 6 ? 'text-danger' : 'text-warning'}`}
                                >
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  {swimmer.missedCount}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ================================================================
              FINANCIAL SUMMARY SECTION
              ================================================================ */}
          <div className="mb-8 report-section report-section-break">
            <h2 className="font-serif text-2xl text-dark-primary mb-4 flex items-center gap-2">
              <PoundSterling className="w-5 h-5 text-lime" />
              Financial Summary
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by month bar chart (hidden in print) */}
              <Card className="report-chart bg-dark-primary border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Revenue by Month</CardTitle>
                  <CardDescription className="text-white/60">
                    Total collected revenue over the last 6 months
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end justify-between gap-3 h-[220px]">
                    {monthlyRevenue.map((m) => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs text-white/60 tabular-nums">
                          {'\u00A3'}
                          {(m.amount / 1000).toFixed(1)}k
                        </span>
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-lime to-lime-light"
                          style={{ height: `${(m.amount / maxRevenue) * 180}px` }}
                        />
                        <span className="text-xs text-white/70 mt-1">{m.month}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Print-only: revenue table */}
              <div className="report-chart-summary hidden">
                <p className="font-semibold mb-1">Revenue by Month</p>
                <table>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyRevenue.map((m) => (
                      <tr key={m.month}>
                        <td>{m.month}</td>
                        <td>
                          {'\u00A3'}
                          {m.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Outstanding invoices and collection rate */}
              <div className="flex flex-col gap-6">
                {/* Collection rate */}
                <Card className="bg-dark-primary border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white">Collection Rate</CardTitle>
                    <CardDescription className="text-white/60">
                      Percentage of invoices paid on time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 report-progress-bar">
                        <div className="w-full h-3 rounded-full overflow-hidden bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-lime to-lime-light"
                            style={{ width: `${collectionRate}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-serif text-3xl text-lime tabular-nums">
                        {collectionRate}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Outstanding invoices */}
                <Card className="flex-1 bg-dark-primary border-white/10">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-white">Outstanding Invoices</CardTitle>
                        <CardDescription className="text-white/60">
                          {pendingInvoices.length} invoices totalling {'\u00A3'}
                          {totalOutstanding.toFixed(2)}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="text-xs bg-warning/20 text-warning">
                        {pendingInvoices.length} pending
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pendingInvoices.length === 0 ? (
                        <p className="text-sm text-white/70">No outstanding invoices.</p>
                      ) : (
                        pendingInvoices.map((inv) => (
                          <div
                            key={inv.invoice_id}
                            className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                          >
                            <div>
                              <p className="text-sm text-white">
                                {inv.family?.family_name ?? 'Unknown Family'}
                              </p>
                              <p className="text-xs text-white/70">
                                Due{' '}
                                {formatDate(inv.due_date, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-white">
                              {'\u00A3'}
                              {Number(inv.total_amount).toFixed(2)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* ================================================================
              MEMBERSHIP OVERVIEW SECTION
              ================================================================ */}
          <div className="mb-8 report-section report-section-break">
            <h2 className="font-serif text-2xl text-dark-primary mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-lime" />
              Membership Overview
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* New joiners */}
              <Card className="bg-dark-primary border-white/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">New Joiners</CardTitle>
                      <CardDescription className="text-white/60">This month</CardDescription>
                    </div>
                    <div className="p-2 rounded-lg bg-lime/20">
                      <UserPlus className="w-5 h-5 text-lime" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {newJoiners.length === 0 ? (
                      <p className="text-sm text-white/70">No new joiners this month.</p>
                    ) : (
                      newJoiners.map((joiner) => (
                        <div
                          key={joiner.swimmerId}
                          className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                        >
                          <div>
                            <p className="text-sm text-white">{joiner.name}</p>
                            <p className="text-xs text-white/70">{joiner.squadName}</p>
                          </div>
                          <span className="text-xs text-white/70">
                            {formatDate(joiner.joinedAt, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-sm text-lime report-trend-icon">
                    <TrendingUp className="w-4 h-4" />
                    <span>{newJoiners.length} new members</span>
                  </div>
                </CardContent>
              </Card>

              {/* Leavers */}
              <Card className="bg-dark-primary border-white/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">Leavers</CardTitle>
                      <CardDescription className="text-white/60">This month</CardDescription>
                    </div>
                    <div className="p-2 rounded-lg bg-danger/20">
                      <UserMinus className="w-5 h-5 text-danger" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {leavers.length === 0 ? (
                      <p className="text-sm text-white/70">No leavers this month.</p>
                    ) : (
                      leavers.map((leaver) => (
                        <div
                          key={leaver.swimmerId}
                          className="flex items-center justify-between py-2 border-b border-white/10 last:border-0"
                        >
                          <div>
                            <p className="text-sm text-white">{leaver.name}</p>
                            <p className="text-xs text-white/70">{leaver.squadName}</p>
                          </div>
                          <span className="text-xs text-white/70">
                            {formatDate(leaver.leftAt, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-sm text-danger report-trend-icon">
                    <TrendingDown className="w-4 h-4" />
                    <span>{leavers.length} members left</span>
                  </div>
                </CardContent>
              </Card>

              {/* Squad distribution */}
              <Card className="bg-dark-primary border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Squad Distribution</CardTitle>
                  <CardDescription className="text-white/60">Swimmers per squad</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Visual distribution bar */}
                  <div className="flex h-3.5 rounded-full overflow-hidden mb-4 report-progress-bar">
                    {squadDistribution.map((squad, index) => (
                      <div
                        key={squad.squadId}
                        style={{
                          width:
                            totalDistribution > 0
                              ? `${(squad.swimmerCount / totalDistribution) * 100}%`
                              : '0%',
                          backgroundColor: getSquadColour(index),
                        }}
                      />
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="space-y-3">
                    {squadDistribution.map((squad, index) => (
                      <div key={squad.squadId} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getSquadColour(index) }}
                          />
                          <span className="text-sm text-white/80">{squad.squadName}</span>
                        </div>
                        <span className="text-sm font-semibold text-white tabular-nums">
                          {squad.swimmerCount}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-sm text-white/60">Total</span>
                    <span className="text-sm font-bold text-white tabular-nums">
                      {totalDistribution}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Print-only footer with generation timestamp */}
          <div className="reports-print-footer hidden">
            <div className="print-footer-inner">
              <span>{clubDisplayName ? `${clubDisplayName}, Confidential` : 'Confidential'}</span>
              <span>
                Report generated{' '}
                {formatDate(new Date(), {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
