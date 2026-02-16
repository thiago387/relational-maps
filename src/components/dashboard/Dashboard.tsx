import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGraphData } from '@/hooks/useGraphData';
import { NetworkGraph } from '@/components/dashboard/NetworkGraph';
import { FilterPanel } from '@/components/dashboard/FilterPanel';
import { StatsPanel } from '@/components/dashboard/StatsPanel';
import { DetailPanel } from '@/components/dashboard/DetailPanel';
import { ImportPanel } from '@/components/dashboard/ImportPanel';
import { ExportPanel } from '@/components/dashboard/ExportPanel';
import { ClusterPanel } from '@/components/dashboard/ClusterPanel';
import { TimelinePanel } from '@/components/dashboard/TimelinePanel';
import { KeyPlayersPanel } from '@/components/dashboard/KeyPlayersPanel';
import { TopicsPanel } from '@/components/dashboard/TopicsPanel';
import { GraphSearchOverlay } from '@/components/dashboard/GraphSearchOverlay';
import { CollapsibleSection } from '@/components/dashboard/CollapsibleSection';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Menu, X, Sun, Moon, Database, Filter, Users, BarChart3, Download,
  CalendarDays, Crown, Tags, LogOut, Shield
} from 'lucide-react';
import { ChatPanel } from '@/components/dashboard/ChatPanel';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GraphNode, GraphLink, GraphData } from '@/types/graph';

function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}

// Filter graph data for ego network mode
function filterEgoNetwork(data: GraphData, egoNodeId: string): GraphData {
  const neighborIds = new Set<string>();
  neighborIds.add(egoNodeId);

  data.links.forEach(link => {
    const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
    const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
    if (s === egoNodeId) neighborIds.add(t);
    if (t === egoNodeId) neighborIds.add(s);
  });

  const nodes = data.nodes.filter(n => neighborIds.has(n.id));
  const links = data.links.filter(link => {
    const s = typeof link.source === 'string' ? link.source : (link.source as any).id;
    const t = typeof link.target === 'string' ? link.target : (link.target as any).id;
    return neighborIds.has(s) && neighborIds.has(t);
  });

  return { nodes, links };
}

export function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const theme = useTheme();
  const { signOut, isAdmin } = useAuth();
  const {
    persons,
    relationships,
    edges,
    emails,
    stats,
    graphData: rawGraphData,
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
  const [egoNodeId, setEgoNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Apply ego network filter
  const graphData = useMemo(() => {
    if (egoNodeId) {
      return filterEgoNetwork(rawGraphData, egoNodeId);
    }
    return rawGraphData;
  }, [rawGraphData, egoNodeId]);

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

  const handleSelectPerson = useCallback((personId: string) => {
    setFilters({ ...filters, selectedPerson: personId });
    const node = graphData.nodes.find(n => n.id === personId);
    if (node) setSelectedNode(node);
  }, [filters, setFilters, graphData.nodes]);

  const handleHighlight = useCallback((ids: Set<string> | null) => {
    setHighlightedNodeIds(ids);
  }, []);

  const egoPersonName = useMemo(() => {
    if (!egoNodeId) return '';
    const node = rawGraphData.nodes.find(n => n.id === egoNodeId);
    return node?.name || egoNodeId;
  }, [egoNodeId, rawGraphData.nodes]);

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
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            📧 Epstein Email Network Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
            Interactive visualization of email communications with sentiment analysis
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={theme.toggle} className="flex-shrink-0">
          {theme.dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        {isAdmin && (
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')} className="flex-shrink-0" title="Manage Users">
            <Shield className="h-5 w-5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={signOut} className="flex-shrink-0" title="Sign Out">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Backdrop when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Graph area - full width always */}
        <main className="h-full w-full relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <NetworkGraph
              data={graphData}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              selectedNodeId={selectedNode?.id}
              highlightedNodeIds={highlightedNodeIds}
            />
          </div>

          {/* Graph search overlay */}
          <GraphSearchOverlay emails={emails} onHighlight={handleHighlight} />

          {/* Ego mode dismiss chip */}
          {egoNodeId && (
            <div className="absolute top-3 left-3 z-10">
              <Badge
                variant="secondary"
                className="text-xs shadow-md bg-background/90 backdrop-blur cursor-pointer gap-1 pr-1"
                onClick={() => setEgoNodeId(null)}
              >
                Ego: {egoPersonName}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            </div>
          )}
          
          <DetailPanel
            selectedNode={selectedNode}
            selectedLink={selectedLink}
            persons={persons}
            relationships={relationships}
            emails={emails}
            onClose={handleCloseDetail}
            onViewMessages={handleViewMessages}
            onIsolateNetwork={(nodeId) => setEgoNodeId(nodeId)}
          />
        </main>

        {/* Sidebar - ALWAYS fixed overlay */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[640px] bg-background shadow-lg border-r border-border
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <ScrollArea className="h-full w-full">
            <div className="p-4 space-y-2 min-w-0 w-full overflow-hidden">
              <CollapsibleSection title="Dataset" icon={Database}>
                <ImportPanel
                  onLoadData={loadData}
                  onClear={clearData}
                  onRefresh={refreshAll}
                  isLoadingData={isLoadingData}
                  isClearing={isClearing}
                  stats={stats}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Filters" icon={Filter}>
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  persons={persons}
                  communities={communities}
                  dateRange={dateRange}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Timeline" icon={CalendarDays}>
                <TimelinePanel
                  emails={emails}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Clusters" icon={Users}>
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
              </CollapsibleSection>

              <CollapsibleSection title="Key Players" icon={Crown}>
                <KeyPlayersPanel
                  graphData={graphData}
                  onSelectPerson={handleSelectPerson}
                />
              </CollapsibleSection>

              <CollapsibleSection title="Topics" icon={Tags}>
                <TopicsPanel emails={emails} />
              </CollapsibleSection>

              <CollapsibleSection title="Statistics" icon={BarChart3}>
                <StatsPanel stats={stats} graphStats={graphStats} />
              </CollapsibleSection>

              <CollapsibleSection title="Export" icon={Download}>
                <ExportPanel
                  graphData={graphData}
                  persons={persons}
                  relationships={relationships}
                  emails={emails}
                />
              </CollapsibleSection>
            </div>
          </ScrollArea>
        </aside>

        {/* Chat Panel */}
        <ChatPanel />
      </div>
    </div>
  );
}
