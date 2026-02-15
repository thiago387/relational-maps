import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGraphData } from '@/hooks/useGraphData';
import { NetworkGraph } from '@/components/dashboard/NetworkGraph';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { StatsPanel } from '@/components/dashboard/StatsPanel';
import { DetailPanel } from '@/components/dashboard/DetailPanel';
import { ImportPanel } from '@/components/dashboard/ImportPanel';
import { ExportPanel } from '@/components/dashboard/ExportPanel';
import { ClusterPanel } from '@/components/dashboard/ClusterPanel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, Menu, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GraphNode, GraphLink } from '@/types/graph';

export function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    persons,
    relationships,
    edges,
    emails,
    stats,
    graphData,
    communities,
    dateRange,
    filters,
    setFilters,
    isLoading,
    loadData,
    isLoadingData,
    clearData,
    isClearing,
    refreshAll,
  } = useGraphData();

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

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

  const handleViewMessages = (person?: string, sender?: string, recipient?: string) => {
    if (sender && recipient) {
      navigate(`/messages?sender=${encodeURIComponent(sender)}&recipient=${encodeURIComponent(recipient)}`);
    } else if (person) {
      navigate(`/messages?person=${encodeURIComponent(person)}`);
    }
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
      <header className="border-b border-border px-4 md:px-6 py-3 md:py-4 flex-shrink-0 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex-shrink-0"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            📧 Epstein Email Network Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
            Interactive visualization of email communications with sentiment analysis
          </p>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile backdrop */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            ${isMobile
              ? 'fixed inset-y-0 left-0 z-50 w-80 bg-background shadow-lg transform transition-transform duration-200'
              : `flex-shrink-0 transition-all duration-200 ${sidebarOpen ? 'w-80 border-r border-border' : 'w-0 border-r-0 overflow-hidden'}`
            }
            ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
          `}
        >
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              <ImportPanel
                onLoadData={loadData}
                onClear={clearData}
                onRefresh={refreshAll}
                isLoadingData={isLoadingData}
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

              <ClusterPanel
                graphData={graphData}
                selectedCommunities={filters.selectedCommunities}
                onCommunityToggle={(communityId) => {
                  const newCommunities = filters.selectedCommunities.includes(communityId)
                    ? filters.selectedCommunities.filter(c => c !== communityId)
                    : [...filters.selectedCommunities, communityId];
                  setFilters({ ...filters, selectedCommunities: newCommunities });
                }}
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
            onViewMessages={handleViewMessages}
          />
        </main>
      </div>
    </div>
  );
}
