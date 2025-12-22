import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  fetchPersons,
  fetchRelationships,
  fetchEmails,
  fetchStats,
  buildGraphData,
  scrapeEmails,
  analyzeSentiment,
  computeGraph,
  importEmails,
  clearAllData,
} from '@/lib/api/graph';
import type { FilterState } from '@/types/graph';

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

  const { data: persons = [], isLoading: personsLoading } = useQuery({
    queryKey: ['persons'],
    queryFn: fetchPersons,
  });

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

  const graphData = useMemo(() => {
    return buildGraphData(persons, relationships, filters);
  }, [persons, relationships, filters]);

  const communities = useMemo(() => {
    const uniqueCommunities = new Set(persons.map(p => p.community_id).filter(c => c !== null));
    return Array.from(uniqueCommunities).sort((a, b) => (a ?? 0) - (b ?? 0));
  }, [persons]);

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

  const scrapeMutation = useMutation({
    mutationFn: ({ url, action }: { url: string; action: string }) => scrapeEmails(url, action),
  });

  const analyzeMutation = useMutation({
    mutationFn: ({ batchSize, jobId }: { batchSize?: number; jobId?: string }) => 
      analyzeSentiment(batchSize, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const computeMutation = useMutation({
    mutationFn: computeGraph,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const importMutation = useMutation({
    mutationFn: importEmails,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
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
    emails,
    stats,
    graphData,
    communities,
    dateRange,
    
    // Filters
    filters,
    setFilters,
    
    // Loading states
    isLoading: personsLoading || relationshipsLoading || emailsLoading || statsLoading,
    
    // Mutations
    scrape: scrapeMutation.mutateAsync,
    isScraping: scrapeMutation.isPending,
    
    analyze: analyzeMutation.mutateAsync,
    isAnalyzing: analyzeMutation.isPending,
    
    compute: computeMutation.mutateAsync,
    isComputing: computeMutation.isPending,
    
    importEmails: importMutation.mutateAsync,
    isImporting: importMutation.isPending,
    
    clearData: clearMutation.mutateAsync,
    isClearing: clearMutation.isPending,
    
    refreshAll,
    refetchStats,
  };
}
