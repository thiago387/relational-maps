import { useMemo } from 'react';
import { Users, ArrowRightLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getCommunityColor } from '@/lib/api/graph';
import { cn } from '@/lib/utils';
import type { GraphData, GraphNode, GraphLink } from '@/types/graph';

export interface ClusterSummary {
  id: number;
  color: string;
  memberCount: number;
  members: { id: string; emailCount: number }[];
  avgSentiment: number | null;
  internalEdges: number;
  externalEdges: number;
  totalMessages: number;
}

interface ClusterPanelProps {
  graphData: GraphData;
  selectedCommunities: number[];
  onCommunityToggle: (communityId: number) => void;
}

function computeClusterSummaries(graphData: GraphData): ClusterSummary[] {
  const { nodes, links } = graphData;

  // Group nodes by communityId
  const communityNodes = new Map<number, GraphNode[]>();
  nodes.forEach(node => {
    const cid = node.communityId ?? -1;
    if (!communityNodes.has(cid)) communityNodes.set(cid, []);
    communityNodes.get(cid)!.push(node);
  });

  const summaries: ClusterSummary[] = [];

  communityNodes.forEach((members, cid) => {
    if (cid === -1) return; // skip unassigned

    const memberIds = new Set(members.map(m => m.id));

    let internalEdges = 0;
    let externalEdges = 0;
    let totalMessages = 0;
    let sentimentSum = 0;
    let sentimentCount = 0;

    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      const sourceIn = memberIds.has(sourceId);
      const targetIn = memberIds.has(targetId);

      if (sourceIn && targetIn) {
        internalEdges++;
        totalMessages += link.emailsAtoB + link.emailsBtoA;
        if (link.avgPolarity !== null) {
          sentimentSum += link.avgPolarity;
          sentimentCount++;
        }
      } else if (sourceIn || targetIn) {
        externalEdges++;
      }
    });

    const sortedMembers = [...members]
      .sort((a, b) => b.emailCount - a.emailCount)
      .map(m => ({ id: m.id, emailCount: m.emailCount }));

    summaries.push({
      id: cid,
      color: getCommunityColor(cid),
      memberCount: members.length,
      members: sortedMembers,
      avgSentiment: sentimentCount > 0 ? sentimentSum / sentimentCount : null,
      internalEdges,
      externalEdges,
      totalMessages,
    });
  });

  return summaries.sort((a, b) => b.memberCount - a.memberCount);
}

function SentimentIndicator({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (sentiment > 0.1) return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (sentiment < -0.1) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function ClusterPanel({ graphData, selectedCommunities, onCommunityToggle }: ClusterPanelProps) {
  const clusters = useMemo(() => computeClusterSummaries(graphData), [graphData]);

  if (clusters.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-4 bg-card rounded-lg border border-border overflow-hidden min-w-0">
      <h3 className="font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" />
        Clusters ({clusters.length} detected)
      </h3>

      <div className="space-y-2 max-h-80 overflow-auto pr-1">
        {clusters.map(cluster => {
          const isSelected = selectedCommunities.includes(cluster.id);
          const topMembers = cluster.members.slice(0, 3);

          return (
            <button
              key={cluster.id}
              onClick={() => onCommunityToggle(cluster.id)}
              className={cn(
                "w-full text-left p-3 rounded-md border transition-all",
                isSelected
                  ? "border-primary bg-accent/50 ring-1 ring-primary"
                  : "border-border hover:bg-accent/30"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cluster.color }}
                  />
                  <span className="text-sm font-medium">
                    Cluster #{cluster.id}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {cluster.memberCount} members
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <SentimentIndicator sentiment={cluster.avgSentiment} />
                  <span className="text-xs font-mono">
                    {cluster.avgSentiment !== null ? cluster.avgSentiment.toFixed(2) : '—'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground truncate">
                {topMembers.map(m => m.id).join(', ')}
                {cluster.members.length > 3 && ` +${cluster.members.length - 3} more`}
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="h-2.5 w-2.5" />
                  {cluster.internalEdges} internal
                </span>
                <span>{cluster.externalEdges} external</span>
                <span>{cluster.totalMessages} msgs</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
