import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getSentimentColor } from '@/lib/api/graph';
import type { GraphData } from '@/types/graph';
import { cn } from '@/lib/utils';
import { ArrowUpDown } from 'lucide-react';

interface KeyPlayersPanelProps {
  graphData: GraphData;
  onSelectPerson: (personId: string) => void;
}

interface PlayerMetric {
  id: string;
  name: string;
  degree: number;
  betweenness: number;
  emails: number;
  avgSentiment: number | null;
}

type SortKey = 'degree' | 'betweenness' | 'emails' | 'avgSentiment';

function computeBetweenness(graphData: GraphData): Map<string, number> {
  const { nodes, links } = graphData;
  const nodeIds = nodes.map(n => n.id);
  const n = nodeIds.length;
  if (n < 3) return new Map(nodeIds.map(id => [id, 0]));

  // Build adjacency list
  const adj = new Map<string, Set<string>>();
  nodeIds.forEach(id => adj.set(id, new Set()));
  links.forEach(link => {
    const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
    const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
    adj.get(s)?.add(t);
    adj.get(t)?.add(s);
  });

  const betweenness = new Map<string, number>(nodeIds.map(id => [id, 0]));
  const normFactor = (n - 1) * (n - 2) / 2;

  // BFS from each node
  for (const s of nodeIds) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    const delta = new Map<string, number>();

    nodeIds.forEach(id => {
      pred.set(id, []);
      sigma.set(id, 0);
      dist.set(id, -1);
      delta.set(id, 0);
    });

    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj.get(v) || []) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) {
        betweenness.set(w, betweenness.get(w)! + delta.get(w)!);
      }
    }
  }

  // Normalize
  if (normFactor > 0) {
    betweenness.forEach((val, key) => {
      betweenness.set(key, val / normFactor);
    });
  }

  return betweenness;
}

export function KeyPlayersPanel({ graphData, onSelectPerson }: KeyPlayersPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>('betweenness');
  const [sortAsc, setSortAsc] = useState(false);

  const players = useMemo(() => {
    const { nodes, links } = graphData;
    if (nodes.length === 0) return [];

    // Degree
    const degreeMap = new Map<string, number>();
    nodes.forEach(n => degreeMap.set(n.id, 0));
    links.forEach(link => {
      const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
      degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
      degreeMap.set(t, (degreeMap.get(t) || 0) + 1);
    });

    // Betweenness (only compute for smaller graphs)
    const betweenness = nodes.length <= 500 ? computeBetweenness(graphData) : new Map<string, number>();

    return nodes.map(n => ({
      id: n.id,
      name: n.name,
      degree: degreeMap.get(n.id) || 0,
      betweenness: betweenness.get(n.id) || 0,
      emails: n.emailCount,
      avgSentiment: n.avgSentiment,
    }));
  }, [graphData]);

  const sorted = useMemo(() => {
    const s = [...players].sort((a, b) => {
      const aVal = a[sortKey] ?? -999;
      const bVal = b[sortKey] ?? -999;
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return s.slice(0, 20);
  }, [players, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  if (players.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No graph data to analyze
      </div>
    );
  }

  return (
    <div className="p-2 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-xs">#</TableHead>
            <TableHead className="text-xs">Name</TableHead>
            <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('degree')}>
              <span className="flex items-center gap-1">Deg <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('betweenness')}>
              <span className="flex items-center gap-1">Btw <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('emails')}>
              <span className="flex items-center gap-1">Vol <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
            <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('avgSentiment')}>
              <span className="flex items-center gap-1">Snt <ArrowUpDown className="h-3 w-3" /></span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p, i) => (
            <TableRow
              key={p.id}
              className="cursor-pointer hover:bg-accent/50"
              onClick={() => onSelectPerson(p.id)}
            >
              <TableCell className="text-xs text-muted-foreground py-1.5">{i + 1}</TableCell>
              <TableCell className="text-xs font-medium py-1.5 max-w-[120px] truncate">{p.name}</TableCell>
              <TableCell className="text-xs py-1.5">{p.degree}</TableCell>
              <TableCell className="text-xs py-1.5">{(p.betweenness * 100).toFixed(1)}%</TableCell>
              <TableCell className="text-xs py-1.5">{p.emails}</TableCell>
              <TableCell className="text-xs py-1.5">
                <div className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getSentimentColor(p.avgSentiment) }}
                  />
                  {p.avgSentiment !== null ? p.avgSentiment.toFixed(2) : '—'}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
