import { supabase } from '@/integrations/supabase/client';
import type { Person, Relationship, Email, ProcessingJob, GraphData, GraphNode, GraphLink, FilterState } from '@/types/graph';

// Community colors - distinct colors for different communities
const COMMUNITY_COLORS = [
  'hsl(210, 90%, 60%)',  // Blue
  'hsl(150, 70%, 50%)',  // Green
  'hsl(280, 70%, 60%)',  // Purple
  'hsl(30, 90%, 55%)',   // Orange
  'hsl(340, 80%, 55%)',  // Pink
  'hsl(180, 70%, 45%)',  // Cyan
  'hsl(60, 80%, 50%)',   // Yellow
  'hsl(0, 70%, 55%)',    // Red
];

// Get sentiment color: red (negative) -> gray (neutral) -> green (positive)
export function getSentimentColor(sentiment: number | null): string {
  if (sentiment === null) return 'hsl(0, 0%, 50%)';
  
  if (sentiment < 0) {
    const intensity = Math.abs(sentiment);
    return `hsl(0, ${60 + intensity * 40}%, ${50 - intensity * 10}%)`;
  } else if (sentiment > 0) {
    const intensity = sentiment;
    return `hsl(120, ${60 + intensity * 40}%, ${50 - intensity * 10}%)`;
  }
  return 'hsl(0, 0%, 50%)';
}

export function getCommunityColor(communityId: number | null): string {
  if (communityId === null) return 'hsl(0, 0%, 60%)';
  return COMMUNITY_COLORS[communityId % COMMUNITY_COLORS.length];
}

export async function fetchPersons(): Promise<Person[]> {
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .order('email_count_sent', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchRelationships(): Promise<Relationship[]> {
  const { data, error } = await supabase
    .from('relationships')
    .select('*');
  
  if (error) throw error;
  return data || [];
}

export async function fetchEmails(limit = 1000): Promise<Email[]> {
  const { data, error } = await supabase
    .from('emails')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data || [];
}

export async function fetchProcessingJobs(): Promise<ProcessingJob[]> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) throw error;
  return data || [];
}

export async function fetchStats(): Promise<{
  emailCount: number;
  analyzedCount: number;
  personCount: number;
  relationshipCount: number;
}> {
  const [emails, analyzed, persons, relationships] = await Promise.all([
    supabase.from('emails').select('*', { count: 'exact', head: true }),
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('is_analyzed', true),
    supabase.from('persons').select('*', { count: 'exact', head: true }),
    supabase.from('relationships').select('*', { count: 'exact', head: true }),
  ]);

  return {
    emailCount: emails.count || 0,
    analyzedCount: analyzed.count || 0,
    personCount: persons.count || 0,
    relationshipCount: relationships.count || 0,
  };
}

export function buildGraphData(
  persons: Person[],
  relationships: Relationship[],
  filters: FilterState
): GraphData {
  // Filter persons based on email count
  const filteredPersons = persons.filter(p => {
    const totalEmails = p.email_count_sent + p.email_count_received;
    if (totalEmails < filters.minEmails) return false;
    
    if (filters.selectedCommunities.length > 0 && p.community_id !== null) {
      if (!filters.selectedCommunities.includes(p.community_id)) return false;
    }
    
    if (filters.selectedPerson && p.id !== filters.selectedPerson) {
      // Check if this person is connected to the selected person
      const isConnected = relationships.some(r =>
        (r.person_a_id === filters.selectedPerson && r.person_b_id === p.id) ||
        (r.person_b_id === filters.selectedPerson && r.person_a_id === p.id)
      );
      if (!isConnected) return false;
    }
    
    return true;
  });

  const personIds = new Set(filteredPersons.map(p => p.id));

  // Filter relationships
  const filteredRelationships = relationships.filter(r => {
    if (!personIds.has(r.person_a_id) || !personIds.has(r.person_b_id)) return false;
    
    const totalEmails = r.emails_a_to_b + r.emails_b_to_a;
    if (totalEmails < filters.minEmails) return false;
    
    // Date filter
    if (filters.dateRange[0] || filters.dateRange[1]) {
      const firstContact = r.first_contact ? new Date(r.first_contact) : null;
      const lastContact = r.last_contact ? new Date(r.last_contact) : null;
      
      if (filters.dateRange[0] && lastContact && lastContact < filters.dateRange[0]) return false;
      if (filters.dateRange[1] && firstContact && firstContact > filters.dateRange[1]) return false;
    }
    
    // Sentiment filter
    const avgSentiment = ((r.sentiment_a_to_b || 0) + (r.sentiment_b_to_a || 0)) / 2;
    if (avgSentiment < filters.sentimentRange[0] || avgSentiment > filters.sentimentRange[1]) return false;
    
    if (filters.showNegativeOnly) {
      if ((r.sentiment_a_to_b || 0) >= 0 && (r.sentiment_b_to_a || 0) >= 0) return false;
    }
    
    return true;
  });

  // Build nodes
  const nodes: GraphNode[] = filteredPersons
    .filter(p => {
      // Only include persons that have at least one relationship after filtering
      return filteredRelationships.some(r => r.person_a_id === p.id || r.person_b_id === p.id);
    })
    .map(p => ({
      id: p.id,
      name: p.name || p.email.split('@')[0],
      email: p.email,
      val: Math.max(5, Math.sqrt(p.email_count_sent + p.email_count_received) * 3),
      color: getCommunityColor(p.community_id),
      communityId: p.community_id,
      emailCount: p.email_count_sent + p.email_count_received,
      avgSentiment: p.avg_sentiment,
    }));

  const nodeIds = new Set(nodes.map(n => n.id));

  // Build links
  const links: GraphLink[] = filteredRelationships
    .filter(r => nodeIds.has(r.person_a_id) && nodeIds.has(r.person_b_id))
    .map(r => {
      const totalEmails = r.emails_a_to_b + r.emails_b_to_a;
      const avgSentiment = ((r.sentiment_a_to_b || 0) + (r.sentiment_b_to_a || 0)) / 2;
      
      return {
        source: r.person_a_id,
        target: r.person_b_id,
        value: Math.max(1, Math.sqrt(totalEmails)),
        color: getSentimentColor(avgSentiment),
        sentimentAtoB: r.sentiment_a_to_b,
        sentimentBtoA: r.sentiment_b_to_a,
        emailsAtoB: r.emails_a_to_b,
        emailsBtoA: r.emails_b_to_a,
        curvature: 0.2,
      };
    });

  return { nodes, links };
}

export async function scrapeEmails(sourceUrl: string, action: string) {
  const { data, error } = await supabase.functions.invoke('scrape-emails', {
    body: { sourceUrl, action },
  });
  
  if (error) throw error;
  return data;
}

export async function analyzeSentiment(batchSize = 10, jobId?: string) {
  const { data, error } = await supabase.functions.invoke('analyze-sentiment', {
    body: { batchSize, jobId },
  });
  
  if (error) throw error;
  return data;
}

export async function computeGraph() {
  const { data, error } = await supabase.functions.invoke('compute-graph', {
    body: {},
  });
  
  if (error) throw error;
  return data;
}

export async function importEmails(emails: Partial<Email>[]) {
  const { data, error } = await supabase.functions.invoke('scrape-emails', {
    body: { emails, action: 'parse' },
  });
  
  if (error) throw error;
  return data;
}

export async function clearAllData() {
  await supabase.from('relationships').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('persons').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('emails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('processing_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}
