import { useState, useMemo } from 'react';
import { useGraphData } from '@/hooks/useGraphData';
import { NetworkGraph } from '@/components/dashboard/NetworkGraph';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { StatsPanel } from '@/components/dashboard/StatsPanel';
import { DetailPanel } from '@/components/dashboard/DetailPanel';
import { ImportPanel } from '@/components/dashboard/ImportPanel';
import { ExportPanel } from '@/components/dashboard/ExportPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import type { GraphNode, GraphLink } from '@/types/graph';

export function Dashboard() {
  const {
    persons,
    relationships,
    emails,
    stats,
    graphData,
    communities,
    dateRange,
    filters,
    setFilters,
    isLoading,
    analyze,
    isAnalyzing,
    compute,
    isComputing,
    importEmails,
    isImporting,
    clearData,
    isClearing,
    refreshAll,
  } = useGraphData();

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);

  const graphStats = useMemo(() => ({
    nodesCount: graphData.nodes.length,
    linksCount: graphData.links.length,
    communitiesCount: new Set(graphData.nodes.map(n => n.communityId).filter(c => c !== null)).size,
  }), [graphData]);

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    setSelectedLink(null);
  };

  const handleLinkClick = (link: GraphLink) => {
    setSelectedLink(link);
    setSelectedNode(null);
  };

  const handleCloseDetail = () => {
    setSelectedNode(null);
    setSelectedLink(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">
          📧 Epstein Email Network Analysis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Interactive visualization of email communications with sentiment analysis
        </p>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 border-r border-border flex-shrink-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <ImportPanel
                onImport={importEmails}
                onAnalyze={analyze}
                onCompute={compute}
                onClear={clearData}
                onRefresh={refreshAll}
                isImporting={isImporting}
                isAnalyzing={isAnalyzing}
                isComputing={isComputing}
                isClearing={isClearing}
                stats={stats}
              />
              
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                persons={persons}
                communities={communities}
                dateRange={dateRange}
              />
              
              <StatsPanel stats={stats} graphStats={graphStats} />
              
              <ExportPanel
                graphData={graphData}
                persons={persons}
                relationships={relationships}
                emails={emails}
              />
            </div>
          </ScrollArea>
        </aside>

        {/* Graph area */}
        <main className="flex-1 relative overflow-hidden">
          <NetworkGraph
            data={graphData}
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            selectedNodeId={selectedNode?.id}
          />
          
          <DetailPanel
            selectedNode={selectedNode}
            selectedLink={selectedLink}
            persons={persons}
            relationships={relationships}
            emails={emails}
            onClose={handleCloseDetail}
          />
        </main>
      </div>
    </div>
  );
}
