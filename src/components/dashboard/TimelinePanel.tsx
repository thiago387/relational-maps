import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import type { Email, FilterState, GraphNode } from '@/types/graph';

interface TimelinePanelProps {
  emails: Email[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  graphNodes?: GraphNode[];
}

const SentimentDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || payload?.avgSentiment == null) return null;
  const color = payload.avgSentiment >= 0 ? 'hsl(120, 70%, 45%)' : 'hsl(0, 70%, 50%)';
  return <circle cx={cx} cy={cy} r={3} fill={color} stroke={color} strokeWidth={1} />;
};

const SentimentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 8,
      fontSize: 12,
      padding: '8px 12px',
    }}>
      <p style={{ marginBottom: 4 }}>Month: {label}</p>
      {payload.map((entry: any) => {
        if (entry.dataKey === 'avgSentiment' && entry.value != null) {
          const color = entry.value >= 0 ? 'hsl(120, 70%, 45%)' : 'hsl(0, 70%, 50%)';
          return (
            <p key={entry.dataKey} style={{ color, margin: 0 }}>
              ● Avg Sentiment: {entry.value}
            </p>
          );
        }
        return (
          <p key={entry.dataKey} style={{ color: 'hsl(var(--primary))', margin: 0 }}>
            Emails: {entry.value}
          </p>
        );
      })}
    </div>
  );
};

export function TimelinePanel({ emails, filters, onFiltersChange, graphNodes }: TimelinePanelProps) {
  const timelineData = useMemo(() => {
    // Build community lookup from graph nodes
    const communityMap = new Map<string, number | null>();
    if (graphNodes) {
      graphNodes.forEach(node => communityMap.set(node.id, node.communityId));
    }

    const selectedCommunities = filters.selectedCommunities ?? [];
    const hasCommunityFilter = selectedCommunities.length > 0 && communityMap.size > 0;
    const selectedSet = new Set(selectedCommunities);

    const monthMap = new Map<string, { count: number; sentimentSum: number; sentimentCount: number }>();

    emails.forEach(email => {
      // Community filtering
      if (hasCommunityFilter && email.sender_id) {
        const community = communityMap.get(email.sender_id);
        if (community == null || !selectedSet.has(community)) return;
      }

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
  }, [emails, filters.selectedCommunities, graphNodes]);

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
            <defs>
              <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(120, 70%, 45%)" />
                <stop offset="50%" stopColor="hsl(60, 50%, 50%)" />
                <stop offset="100%" stopColor="hsl(0, 70%, 50%)" />
              </linearGradient>
            </defs>
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
            <Tooltip content={<SentimentTooltip />} />
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
              stroke="url(#sentimentGradient)"
              strokeWidth={2}
              dot={<SentimentDot />}
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
