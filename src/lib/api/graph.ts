import { supabase } from '@/integrations/supabase/client';
import type { Person, Relationship, Email, ProcessingJob, GraphData, GraphNode, GraphLink, FilterState, Edge } from '@/types/graph';
import { detectCommunities } from '@/lib/communityDetection';
import { buildIdNormalizationMap } from '@/lib/utils';

// Merged edge type for internal use
interface MergedEdge {
  sender_id: string;
  recipient_id: string;
  message_count: number;
  avg_polarity: number | null;
  edge_sentiment: string | null;
  original_edge_count: number;
}

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

export async function fetchEdges(): Promise<Edge[]> {
  const { data, error } = await supabase
    .from('edges')
    .select('*')
    .order('message_count', { ascending: false });
  
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
  return (data || []) as Email[];
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
  edgeCount: number;
}> {
  const [emails, analyzed, persons, relationships, edges] = await Promise.all([
    supabase.from('emails').select('*', { count: 'exact', head: true }),
    supabase.from('emails').select('*', { count: 'exact', head: true }).eq('is_analyzed', true),
    supabase.from('persons').select('*', { count: 'exact', head: true }),
    supabase.from('relationships').select('*', { count: 'exact', head: true }),
    supabase.from('edges').select('*', { count: 'exact', head: true }),
  ]);

  return {
    emailCount: emails.count || 0,
    analyzedCount: analyzed.count || 0,
    personCount: persons.count || 0,
    relationshipCount: relationships.count || 0,
    edgeCount: edges.count || 0,
  };
}

// Merge edges with same sender-recipient pair and calculate weighted average polarity
function mergeEdges(edges: Edge[]): MergedEdge[] {
  // First, collect all unique IDs and build normalization map
  const allIds = new Set<string>();
  edges.forEach(edge => {
    allIds.add(edge.sender_id);
    allIds.add(edge.recipient_id);
  });
  const idMap = buildIdNormalizationMap(Array.from(allIds));
  
  // Group edges by normalized sender-recipient pairs
  const edgeGroups = new Map<string, Edge[]>();
  edges.forEach(edge => {
    const normalizedSender = idMap.get(edge.sender_id) || edge.sender_id;
    const normalizedRecipient = idMap.get(edge.recipient_id) || edge.recipient_id;
    const key = `${normalizedSender}→${normalizedRecipient}`;
    
    if (!edgeGroups.has(key)) edgeGroups.set(key, []);
    edgeGroups.get(key)!.push(edge);
  });
  
  // Merge edges with weighted average polarity
  const mergedEdges: MergedEdge[] = [];
  edgeGroups.forEach((group, key) => {
    const [sender, recipient] = key.split('→');
    const totalMessages = group.reduce((sum, e) => sum + (e.message_count || 1), 0);
    
    // Calculate weighted average polarity
    let weightedPolarity: number | null = null;
    const edgesWithPolarity = group.filter(e => e.avg_polarity !== null);
    if (edgesWithPolarity.length > 0) {
      const totalWeight = edgesWithPolarity.reduce((sum, e) => sum + (e.message_count || 1), 0);
      weightedPolarity = edgesWithPolarity.reduce((sum, e) => 
        sum + (e.avg_polarity || 0) * (e.message_count || 1), 0) / totalWeight;
    }
    
    // Determine sentiment category based on weighted polarity
    let edgeSentiment: string | null = null;
    if (weightedPolarity !== null) {
      edgeSentiment = weightedPolarity > 0.1 ? 'positive' : weightedPolarity < -0.1 ? 'negative' : 'neutral';
    }
    
    mergedEdges.push({
      sender_id: sender,
      recipient_id: recipient,
      message_count: totalMessages,
      avg_polarity: weightedPolarity,
      edge_sentiment: edgeSentiment,
      original_edge_count: group.length,
    });
  });
  
  return mergedEdges;
}

// Build graph from pre-computed edges (new method)
export function buildGraphFromEdges(
  edges: Edge[],
  filters: FilterState
): GraphData {
  // Merge edges first for accurate sentiment calculation
  const mergedEdges = mergeEdges(edges);
  
  // Detect communities from merged edges
  const edgesForCommunity = mergedEdges.map(e => ({
    sender_id: e.sender_id,
    recipient_id: e.recipient_id,
    message_count: e.message_count,
  }));
  const communityMap = detectCommunities(edgesForCommunity as any);
  
  // Filter merged edges
  const filteredEdges = mergedEdges.filter(edge => {
    // Min emails filter
    if (edge.message_count < filters.minEmails) return false;
    
    // Sentiment filter
    if (edge.avg_polarity !== null) {
      if (edge.avg_polarity < filters.sentimentRange[0] || 
          edge.avg_polarity > filters.sentimentRange[1]) {
        return false;
      }
    }
    
    // Negative only filter
    if (filters.showNegativeOnly && (edge.avg_polarity === null || edge.avg_polarity >= 0)) {
      return false;
    }
    
    // Selected person filter
    if (filters.selectedPerson) {
      if (edge.sender_id !== filters.selectedPerson && 
          edge.recipient_id !== filters.selectedPerson) {
        return false;
      }
    }

    // Community filter: only show edges where at least one endpoint is in the selected communities
    if (filters.selectedCommunities.length > 0) {
      const senderCom = communityMap.get(edge.sender_id) ?? null;
      const recipientCom = communityMap.get(edge.recipient_id) ?? null;
      const senderMatch = senderCom !== null && filters.selectedCommunities.includes(senderCom);
      const recipientMatch = recipientCom !== null && filters.selectedCommunities.includes(recipientCom);
      if (!senderMatch && !recipientMatch) return false;
    }
    
    return true;
  });

  // Build nodes with proper sentiment aggregation
  const nodeMap = new Map<string, GraphNode>();
  const nodeSentimentStats = new Map<string, { totalPolarity: number; totalMessages: number }>();
  
  filteredEdges.forEach(edge => {
    const senderCommunity = communityMap.get(edge.sender_id) ?? null;
    const recipientCommunity = communityMap.get(edge.recipient_id) ?? null;
    
    // Track sentiment stats for sender (sent emails contribute to their sentiment)
    if (edge.avg_polarity !== null) {
      const senderStats = nodeSentimentStats.get(edge.sender_id) || { totalPolarity: 0, totalMessages: 0 };
      senderStats.totalPolarity += edge.avg_polarity * edge.message_count;
      senderStats.totalMessages += edge.message_count;
      nodeSentimentStats.set(edge.sender_id, senderStats);
    }
    
    // Sender node
    if (!nodeMap.has(edge.sender_id)) {
      nodeMap.set(edge.sender_id, {
        id: edge.sender_id,
        name: edge.sender_id,
        email: edge.sender_id,
        val: 5,
        color: getCommunityColor(senderCommunity),
        communityId: senderCommunity,
        emailCount: edge.message_count,
        avgSentiment: null,
      });
    } else {
      const existing = nodeMap.get(edge.sender_id)!;
      existing.emailCount += edge.message_count;
    }

    // Recipient node
    if (!nodeMap.has(edge.recipient_id)) {
      nodeMap.set(edge.recipient_id, {
        id: edge.recipient_id,
        name: edge.recipient_id,
        email: edge.recipient_id,
        val: 5,
        color: getCommunityColor(recipientCommunity),
        communityId: recipientCommunity,
        emailCount: edge.message_count,
        avgSentiment: null,
      });
    } else {
      const existing = nodeMap.get(edge.recipient_id)!;
      existing.emailCount += edge.message_count;
    }
  });

  // Calculate and assign average sentiment + bridge detection
  // Bridge: node connects to 2+ different communities
  const nodeCommunityNeighbors = new Map<string, Set<number>>();
  filteredEdges.forEach(edge => {
    const sCom = communityMap.get(edge.sender_id) ?? -1;
    const rCom = communityMap.get(edge.recipient_id) ?? -1;
    if (!nodeCommunityNeighbors.has(edge.sender_id)) nodeCommunityNeighbors.set(edge.sender_id, new Set());
    if (!nodeCommunityNeighbors.has(edge.recipient_id)) nodeCommunityNeighbors.set(edge.recipient_id, new Set());
    if (rCom >= 0) nodeCommunityNeighbors.get(edge.sender_id)!.add(rCom);
    if (sCom >= 0) nodeCommunityNeighbors.get(edge.recipient_id)!.add(sCom);
  });

  nodeMap.forEach((node, id) => {
    const stats = nodeSentimentStats.get(id);
    if (stats && stats.totalMessages > 0) {
      node.avgSentiment = stats.totalPolarity / stats.totalMessages;
    }
    const neighborCommunities = nodeCommunityNeighbors.get(id);
    node.isBridge = neighborCommunities ? neighborCommunities.size >= 2 : false;
  });

  // Convert node map to array and adjust sizes
  const nodes: GraphNode[] = [];
  nodeMap.forEach(node => {
    node.val = Math.max(5, Math.log(node.emailCount + 1) * 3);
    nodes.push(node);
  });

  // Build links from merged edges
  const links: GraphLink[] = filteredEdges.map(edge => ({
    source: edge.sender_id,
    target: edge.recipient_id,
    value: Math.max(1, Math.sqrt(edge.message_count)),
    color: getSentimentColor(edge.avg_polarity),
    sentimentAtoB: edge.avg_polarity,
    sentimentBtoA: null,
    emailsAtoB: edge.message_count,
    emailsBtoA: 0,
    curvature: 0.2,
    avgPolarity: edge.avg_polarity,
    edgeSentiment: edge.edge_sentiment,
    mergedEdgeCount: edge.original_edge_count,
  }));

  return { nodes, links };
}

// Legacy: Build graph from persons/relationships
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
    
    if (filters.dateRange[0] || filters.dateRange[1]) {
      const firstContact = r.first_contact ? new Date(r.first_contact) : null;
      const lastContact = r.last_contact ? new Date(r.last_contact) : null;
      
      if (filters.dateRange[0] && lastContact && lastContact < filters.dateRange[0]) return false;
      if (filters.dateRange[1] && firstContact && firstContact > filters.dateRange[1]) return false;
    }
    
    const avgSentiment = ((r.sentiment_a_to_b || 0) + (r.sentiment_b_to_a || 0)) / 2;
    if (avgSentiment < filters.sentimentRange[0] || avgSentiment > filters.sentimentRange[1]) return false;
    
    if (filters.showNegativeOnly) {
      if ((r.sentiment_a_to_b || 0) >= 0 && (r.sentiment_b_to_a || 0) >= 0) return false;
    }
    
    return true;
  });

  // Build nodes
  const nodes: GraphNode[] = filteredPersons
    .filter(p => filteredRelationships.some(r => r.person_a_id === p.id || r.person_b_id === p.id))
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
        avgPolarity: avgSentiment,
        edgeSentiment: null,
      };
    });

  return { nodes, links };
}

export async function clearAllData() {
  await Promise.all([
    supabase.from('edges').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('relationships').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('persons').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('emails').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('processing_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
  ]);
}
