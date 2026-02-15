import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  fetchPersons,
  fetchRelationships,
  fetchEmails,
  fetchStats,
  fetchEdges,
  buildGraphData,
  buildGraphFromEdges,
  clearAllData,
} from '@/lib/api/graph';
import { loadPrecomputedData } from '@/lib/precomputedDataLoader';
import type { FilterState, Edge } from '@/types/graph';

export function useGraphData() {
  const queryClient = useQueryClient();
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: [null, null],
    minEmails: 1,
    sentimentRange: [-1, 1],
    selectedPerson: null,
    selectedCommunities: [],
    showNegativeOnly: false,
  });

  // Fetch edges (pre-computed data)
  const { data: edges = [], isLoading: edgesLoading } = useQuery({
    queryKey: ['edges'],
    queryFn: fetchEdges,
  });

  // Legacy: fetch persons (for compatibility)
  const { data: persons = [], isLoading: personsLoading } = useQuery({
    queryKey: ['persons'],
    queryFn: fetchPersons,
  });

  // Legacy: fetch relationships (for compatibility)
  const { data: relationships = [], isLoading: relationshipsLoading } = useQuery({
    queryKey: ['relationships'],
    queryFn: fetchRelationships,
  });

  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['emails'],
    queryFn: () => fetchEmails(1000),
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });

  // Build graph from pre-computed edges if available, otherwise fall back to persons/relationships
  const graphData = useMemo(() => {
    if (edges.length > 0) {
      return buildGraphFromEdges(edges, filters);
    }
    return buildGraphData(persons, relationships, filters);
  }, [edges, persons, relationships, filters]);

  // Get unique person IDs from edges for dropdown/search
  const personIds = useMemo(() => {
    const ids = new Set<string>();
    edges.forEach(edge => {
      ids.add(edge.sender_id);
      ids.add(edge.recipient_id);
    });
    return Array.from(ids).sort();
  }, [edges]);

  const communities = useMemo(() => {
    // Derive communities from graph nodes (edge-based detection) instead of legacy persons
    const fromGraph = new Set(graphData.nodes.map(n => n.communityId).filter(c => c !== null));
    if (fromGraph.size > 0) {
      return Array.from(fromGraph).sort((a, b) => (a ?? 0) - (b ?? 0));
    }
    // Fallback to legacy persons
    const fromPersons = new Set(persons.map(p => p.community_id).filter(c => c !== null));
    return Array.from(fromPersons).sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [graphData.nodes, persons]);

  const dateRange = useMemo(() => {
    const dates = relationships
      .flatMap(r => [r.first_contact, r.last_contact])
      .filter(d => d !== null)
      .map(d => new Date(d!));
    
    if (dates.length === 0) return [null, null] as [Date | null, Date | null];
    
    return [
      new Date(Math.min(...dates.map(d => d.getTime()))),
      new Date(Math.max(...dates.map(d => d.getTime()))),
    ] as [Date, Date];
  }, [relationships]);

  // Load pre-computed data mutation
  const loadDataMutation = useMutation({
    mutationFn: (onProgress?: (stage: string, loaded: number, total: number) => void) => 
      loadPrecomputedData(onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const clearMutation = useMutation({
    mutationFn: clearAllData,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  return {
    // Data
    persons,
    relationships,
    edges,
    emails,
    stats,
    graphData,
    communities,
    personIds,
    dateRange,
    
    // Filters
    filters,
    setFilters,
    
    // Loading states
    isLoading: edgesLoading || personsLoading || relationshipsLoading || emailsLoading || statsLoading,
    
    // Mutations
    loadData: loadDataMutation.mutateAsync,
    isLoadingData: loadDataMutation.isPending,
    
    clearData: clearMutation.mutateAsync,
    isClearing: clearMutation.isPending,
    
    refreshAll,
    refetchStats,
  };
}
