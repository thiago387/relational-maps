import type { Edge } from '@/types/graph';

/**
 * Detect communities (connected components) from edges using BFS
 * Returns a Map of personId → communityId
 */
export function detectCommunities(edges: Edge[]): Map<string, number> {
  // Build adjacency list from edges
  const adjacency = new Map<string, Set<string>>();
  
  edges.forEach(edge => {
    if (!adjacency.has(edge.sender_id)) {
      adjacency.set(edge.sender_id, new Set());
    }
    if (!adjacency.has(edge.recipient_id)) {
      adjacency.set(edge.recipient_id, new Set());
    }
    
    adjacency.get(edge.sender_id)!.add(edge.recipient_id);
    adjacency.get(edge.recipient_id)!.add(edge.sender_id);
  });
  
  // BFS to find connected components
  const visited = new Set<string>();
  const communities = new Map<string, number>();
  let communityId = 0;
  
  for (const nodeId of adjacency.keys()) {
    if (!visited.has(nodeId)) {
      // BFS from this node
      const queue = [nodeId];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        
        visited.add(current);
        communities.set(current, communityId);
        
        for (const neighbor of adjacency.get(current) || []) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
      
      communityId++;
    }
  }
  
  return communities;
}

/**
 * Get the number of unique communities detected
 */
export function getCommunityCount(communities: Map<string, number>): number {
  const uniqueCommunities = new Set(communities.values());
  return uniqueCommunities.size;
}
