'use client';

import { TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { type CompetitionResult } from '@/lib/api/competitions';
import { formatSwimTime } from '@/lib/competitions-utils';

// Recharts needs concrete colour values; these mirror tailwind.config tokens.
const CHART = {
  brand: '#85FFC7',
  grid: '#163F3F',
  axis: '#B3B3B3',
} as const;

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#0F2D2D',
  border: '1px solid #163F3F',
  borderRadius: '12px',
};

interface ChartPoint {
  timestamp: number;
  dateLabel: string;
  time: number;
  isPb: boolean;
  meet: string;
}

interface EventSeries {
  key: string;
  label: string;
  points: ChartPoint[];
}

function buildSeries(results: CompetitionResult[], locale: string): EventSeries[] {
  const byEvent = new Map<string, EventSeries>();

  for (const result of results) {
    if (result.dq || result.is_relay || Number(result.time) <= 0) continue;
    const course = result.course ?? result.competition?.course ?? 'SC';
    const key = `${result.distance}|${result.stroke}|${course}`;
    const dateStr = result.swum_at ?? result.competition?.start_date ?? result.created_at;
    const timestamp = new Date(dateStr).getTime();
    if (Number.isNaN(timestamp)) continue;

    if (!byEvent.has(key)) {
      byEvent.set(key, {
        key,
        label: `${result.distance}m ${result.stroke} (${course})`,
        points: [],
      });
    }
    byEvent.get(key)!.points.push({
      timestamp,
      dateLabel: new Date(dateStr).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      time: Number(result.time),
      isPb: result.is_pb,
      meet: result.competition?.name ?? '',
    });
  }

  for (const series of Array.from(byEvent.values())) {
    series.points.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Events with the most swims first: those are the ones worth charting.
  return Array.from(byEvent.values()).sort((a, b) => b.points.length - a.points.length);
}

interface ProgressionChartProps {
  results: CompetitionResult[];
  locale?: string;
}

export default function ProgressionChart({ results, locale = 'en-GB' }: ProgressionChartProps) {
  const series = useMemo(() => buildSeries(results, locale), [results, locale]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = series.find((s) => s.key === selectedKey) ?? series[0];

  if (!selected || selected.points.length < 2) {
    return null;
  }

  const first = selected.points[0].time;
  const latestBest = Math.min(...selected.points.map((p) => p.time));
  const improvement = first - latestBest;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-brand" />
          <h3 className="font-serif text-xl text-white">Progression</h3>
        </div>
        <select
          value={selected.key}
          onChange={(e) => setSelectedKey(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 min-h-[44px] text-sm text-white focus:outline-none focus:border-brand/50"
          aria-label="Choose event"
        >
          {series.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({s.points.length} swims)
            </option>
          ))}
        </select>
      </div>

      {improvement > 0 && (
        <p className="text-text-secondary text-sm">
          Improved by{' '}
          <span className="text-brand font-semibold tabular-nums">
            {formatSwimTime(improvement)}
          </span>{' '}
          since their first recorded {selected.label} swim.
        </p>
      )}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={selected.points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis
              dataKey="dateLabel"
              stroke={CHART.axis}
              tick={{ fill: CHART.axis, fontSize: 12 }}
            />
            <YAxis
              reversed
              domain={['dataMin - 1', 'dataMax + 1']}
              stroke={CHART.axis}
              tick={{ fill: CHART.axis, fontSize: 12 }}
              tickFormatter={(value: number) => formatSwimTime(value)}
              width={72}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={{ color: '#F0F0F0' }}
              formatter={(value) => [formatSwimTime(Number(value)), 'Time']}
            />
            <Line
              type="monotone"
              dataKey="time"
              stroke={CHART.brand}
              strokeWidth={2}
              dot={{ r: 4, fill: CHART.brand }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-text-tertiary text-xs">
        Lower is faster; the chart runs downhill as times improve.
      </p>
    </div>
  );
}
