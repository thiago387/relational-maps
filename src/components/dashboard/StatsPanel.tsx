import { Mail, Users, GitBranch, BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatsPanelProps {
  stats: {
    emailCount: number;
    analyzedCount: number;
    personCount: number;
    edgeCount: number;
  } | undefined;
  graphStats: {
    nodesCount: number;
    linksCount: number;
    communitiesCount: number;
  };
}

export function StatsPanel({ stats, graphStats }: StatsPanelProps) {
  const analysisProgress = stats && stats.emailCount > 0 
    ? Math.round((stats.analyzedCount / stats.emailCount) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground">Statistics</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="text-xs">Emails</span>
          </div>
          <p className="text-xl font-bold">{stats?.emailCount.toLocaleString() || 0}</p>
          <p className="text-xs text-muted-foreground">
            {stats?.analyzedCount.toLocaleString() || 0} analyzed ({analysisProgress}%)
          </p>
        </Card>

        <Card className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="text-xs">People</span>
          </div>
          <p className="text-xl font-bold">{stats?.personCount.toLocaleString() || 0}</p>
          <p className="text-xs text-muted-foreground">
            {graphStats.nodesCount} in graph
          </p>
        </Card>

        <Card className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            <span className="text-xs">Connections</span>
          </div>
          <p className="text-xl font-bold">{stats?.edgeCount.toLocaleString() || 0}</p>
          <p className="text-xs text-muted-foreground">
            {graphStats.linksCount} visible
          </p>
        </Card>

        <Card className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-3 w-3" />
            <span className="text-xs">Communities</span>
          </div>
          <p className="text-xl font-bold">{graphStats.communitiesCount}</p>
          <p className="text-xs text-muted-foreground">
            detected clusters
          </p>
        </Card>
      </div>

      <Card className="p-3">
        <h4 className="text-xs font-medium text-muted-foreground mb-2">Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(0,70%,50%)]" />
            <span>Negative Sentiment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(0,0%,50%)]" />
            <span>Neutral Sentiment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[hsl(120,70%,45%)]" />
            <span>Positive Sentiment</span>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
            <TrendingUp className="h-3 w-3" />
            <span>Arrow shows dominant communication direction</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-1 bg-muted-foreground rounded" />
            <span>Line thickness = email volume</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
