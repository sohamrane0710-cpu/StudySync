import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';
import { formatSecondsToHuman } from '@/lib/utils/format';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, Clock, Flame, CheckCircle, Target } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => analyticsApi.getSummary(),
  });

  const { data: categoryStats = [], isLoading: isCatLoading } = useQuery({
    queryKey: ['analytics', 'categories'],
    queryFn: () => analyticsApi.getCategories(),
  });

  const { data: labelStats = [] } = useQuery({
    queryKey: ['analytics', 'labels'],
    queryFn: () => analyticsApi.getLabels(),
  });

  // Calculate current streak accurately from daily breakdown
  const currentStreak = useMemo(() => {
    if (!summary?.dailyBreakdown || summary.dailyBreakdown.length === 0) return 0;

    const daysWithStudy = new Set(
      summary.dailyBreakdown
        .filter((d) => d.focusSeconds > 0)
        .map((d) => d.date)
    );

    let streak = 0;
    const checkDate = new Date();

    // Check today or yesterday as starting point
    let dateStr = checkDate.toISOString().split('T')[0];
    if (!daysWithStudy.has(dateStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = checkDate.toISOString().split('T')[0];
    }

    while (daysWithStudy.has(dateStr)) {
      streak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
      dateStr = checkDate.toISOString().split('T')[0];
    }

    return streak;
  }, [summary]);

  const completionRate = useMemo(() => {
    if (!summary || summary.totalSessionsCount === 0) return 0;
    return Math.round((summary.completedSessionsCount / summary.totalSessionsCount) * 100);
  }, [summary]);

  const chartData = useMemo(() => {
    if (!summary?.dailyBreakdown) return [];
    return summary.dailyBreakdown.map((item) => ({
      date: item.date.slice(5), // "MM-DD"
      minutes: Math.round(item.focusSeconds / 60),
      sessions: item.sessionsCount,
    }));
  }, [summary]);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-amber-400" />
          Productivity Analytics
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Deep work trends and taxonomy breakdown calculated from your authoritative focus records.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Focus Time */}
        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Total Focus</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {isSummaryLoading
              ? '...'
              : formatSecondsToHuman(summary?.totalFocusSeconds || 0)}
          </div>
          <span className="text-[11px] text-zinc-500">
            {summary?.totalSessionsCount || 0} total sessions
          </span>
        </div>

        {/* Current Daily Streak */}
        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Daily Streak</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono flex items-baseline gap-1.5">
            <span>{currentStreak}</span>
            <span className="text-xs font-sans text-zinc-400 font-normal">days</span>
          </div>
          <span className="text-[11px] text-zinc-500">Consecutive study days</span>
        </div>

        {/* Completion Rate */}
        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Completion Rate</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {completionRate}%
          </div>
          <span className="text-[11px] text-zinc-500">
            {summary?.completedSessionsCount || 0} completed · {summary?.interruptedSessionsCount || 0} interrupted
          </span>
        </div>

        {/* Average Session Duration */}
        <div className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-xl flex flex-col gap-2 shadow-sm">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-medium">Average Session</span>
            <Target className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-white font-mono">
            {isSummaryLoading
              ? '...'
              : formatSecondsToHuman(summary?.averageSessionSeconds || 0)}
          </div>
          <span className="text-[11px] text-zinc-500">Target consistency</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Focus Trend Area Chart */}
        <div className="lg:col-span-2 p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Daily Focus Time (Minutes)</h2>
            <span className="text-xs font-mono text-zinc-500">Last 7-14 Days</span>
          </div>

          <div className="h-64 w-full mt-2">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                No daily focus recorded yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="focusGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#52525B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#52525B"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#12151A',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F4F4F5',
                    }}
                    formatter={(value: any) => [`${value} mins`, 'Focus Time']}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#focusGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown Donut Chart */}
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-200">Category Distribution</h2>

          <div className="h-52 w-full flex items-center justify-center">
            {categoryStats.length === 0 || isCatLoading ? (
              <span className="text-xs text-zinc-500">No categories tagged yet</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    dataKey="totalSeconds"
                    nameKey="categoryName"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || '#6366F1'}
                        stroke="#101319"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#12151A',
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: '#F4F4F5',
                    }}
                    formatter={(value: any) => [
                      formatSecondsToHuman(Number(value)),
                      'Focus Time',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto pr-1">
            {categoryStats.map((cat) => (
              <div key={cat.categoryId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-zinc-300 truncate">{cat.categoryName}</span>
                </div>
                <span className="font-mono text-zinc-500 text-[11px] shrink-0 ml-2">
                  {formatSecondsToHuman(cat.totalSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Labels Breakdown */}
      {labelStats.length > 0 && (
        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-xl flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-200">Sub-Taxonomy Labels</h2>
          <div className="flex flex-wrap gap-2.5">
            {labelStats.map((lbl) => (
              <div
                key={lbl.labelId}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md text-xs font-medium"
                style={{
                  backgroundColor: `${lbl.color}15`,
                  borderColor: `${lbl.color}35`,
                  color: lbl.color,
                }}
              >
                <span>#{lbl.labelName}</span>
                <span className="text-[11px] opacity-75 font-mono">
                  {formatSecondsToHuman(lbl.totalSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
