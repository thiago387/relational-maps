import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import type { Email, FilterState } from '@/types/graph';

interface TimelinePanelProps {
  emails: Email[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function TimelinePanel({ emails, filters, onFiltersChange }: TimelinePanelProps) {
  const timelineData = useMemo(() => {
    const monthMap = new Map<string, { count: number; sentimentSum: number; sentimentCount: number }>();

    emails.forEach(email => {
      let key: string | null = null;
      if (email.year && email.month) {
        key = `${email.year}-${String(email.month).padStart(2, '0')}`;
      } else if (email.date) {
        const d = new Date(email.date);
        if (!isNaN(d.getTime())) {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
      }
      if (!key) return;

      const existing = monthMap.get(key) || { count: 0, sentimentSum: 0, sentimentCount: 0 };
      existing.count++;
      const sentiment = email.polarity ?? email.sentiment_score;
      if (sentiment !== null) {
        existing.sentimentSum += sentiment;
        existing.sentimentCount++;
      }
      monthMap.set(key, existing);
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        label: month,
        count: data.count,
        avgSentiment: data.sentimentCount > 0 ? +(data.sentimentSum / data.sentimentCount).toFixed(3) : null,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [emails]);

  if (timelineData.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No timeline data available
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <div className="h-48 overflow-hidden min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={timelineData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => {
                const [y, m] = v.split('-');
                return `${m}/${y.slice(2)}`;
              }}
              interval="preserveStartEnd"
            />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" domain={[-1, 1]} tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(v) => `Month: ${v}`}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="count"
              fill="hsl(var(--primary) / 0.2)"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              name="Emails"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgSentiment"
              stroke="hsl(120, 70%, 45%)"
              strokeWidth={2}
              dot={false}
              name="Avg Sentiment"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">
        Email volume (area) &amp; average sentiment (line) over time
      </p>
    </div>
  );
}
