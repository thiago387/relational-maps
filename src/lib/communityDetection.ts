import type { Edge } from '@/types/graph';

interface WeightedEdge {
  sender_id: string;
  recipient_id: string;
  message_count: number;
}

/**
 * Louvain-style modularity-based community detection.
 * Uses edge weights (message_count) to find densely connected sub-groups.
 * Returns a Map of personId → communityId
 */
export function detectCommunities(edges: WeightedEdge[]): Map<string, number> {
  if (edges.length === 0) return new Map();

  // Build undirected weighted adjacency: merge A→B and B→A
  const pairWeights = new Map<string, number>();
  const nodeSet = new Set<string>();

  edges.forEach(edge => {
    nodeSet.add(edge.sender_id);
    nodeSet.add(edge.recipient_id);
    const a = edge.sender_id < edge.recipient_id ? edge.sender_id : edge.recipient_id;
    const b = edge.sender_id < edge.recipient_id ? edge.recipient_id : edge.sender_id;
    const key = `${a}\0${b}`;
    pairWeights.set(key, (pairWeights.get(key) || 0) + (edge.message_count || 1));
  });

  const nodes = Array.from(nodeSet);
  const nodeIndex = new Map<string, number>();
  nodes.forEach((id, i) => nodeIndex.set(id, i));

  const n = nodes.length;

  // Adjacency list with weights
  const adj: { neighbor: number; weight: number }[][] = Array.from({ length: n }, () => []);
  let totalWeight = 0;

  pairWeights.forEach((weight, key) => {
    const [a, b] = key.split('\0');
    const ai = nodeIndex.get(a)!;
    const bi = nodeIndex.get(b)!;
    adj[ai].push({ neighbor: bi, weight });
    adj[bi].push({ neighbor: ai, weight });
    totalWeight += weight;
  });

  if (totalWeight === 0) {
    // No weights, assign all to community 0
    const result = new Map<string, number>();
    nodes.forEach(id => result.set(id, 0));
    return result;
  }

  const m2 = totalWeight * 2; // sum of all weights (each edge counted twice in undirected)

  // Degree (sum of weights) for each node
  const degree = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (const e of adj[i]) d += e.weight;
    degree[i] = d;
  }

  // Initialize: each node in its own community
  const community = new Int32Array(n);
  for (let i = 0; i < n; i++) community[i] = i;

  // Sum of weights inside each community and total degree of each community
  const communityInternalWeight = new Float64Array(n);
  const communityTotalDegree = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    communityTotalDegree[i] = degree[i];
    // Self-loops would go here, but we have none
  }

  // Louvain phase 1: local moves
  let improved = true;
  let iterations = 0;
  const maxIterations = 20;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < n; i++) {
      const currentCom = community[i];
      const ki = degree[i];

      // Calculate weight from node i to each neighboring community
      const neighborComWeights = new Map<number, number>();
      let weightToOwnCom = 0;

      for (const e of adj[i]) {
        const neighborCom = community[e.neighbor];
        neighborComWeights.set(neighborCom, (neighborComWeights.get(neighborCom) || 0) + e.weight);
      }
      weightToOwnCom = neighborComWeights.get(currentCom) || 0;

      // Remove node i from its community
      communityInternalWeight[currentCom] -= weightToOwnCom;
      communityTotalDegree[currentCom] -= ki;

      // Find best community to move to
      let bestCom = currentCom;
      let bestGain = 0;

      neighborComWeights.forEach((wic, com) => {
        // Modularity gain of moving i to community com
        const gain = wic - (communityTotalDegree[com] * ki) / m2;
        if (gain > bestGain) {
          bestGain = gain;
          bestCom = com;
        }
      });

      // Also check staying in current (empty) community
      const stayGain = weightToOwnCom - (communityTotalDegree[currentCom] * ki) / m2;
      if (stayGain >= bestGain) {
        bestCom = currentCom;
        bestGain = stayGain;
      }

      // Move node to best community
      community[i] = bestCom;
      communityInternalWeight[bestCom] += (neighborComWeights.get(bestCom) || 0);
      communityTotalDegree[bestCom] += ki;

      if (bestCom !== currentCom) {
        improved = true;
      }
    }
  }

  // Renumber communities to be sequential starting from 0
  const communityRemap = new Map<number, number>();
  let nextId = 0;
  const result = new Map<string, number>();

  for (let i = 0; i < n; i++) {
    const com = community[i];
    if (!communityRemap.has(com)) {
      communityRemap.set(com, nextId++);
    }
    result.set(nodes[i], communityRemap.get(com)!);
  }

  return result;
}

/**
 * Get the number of unique communities detected
 */
export function getCommunityCount(communities: Map<string, number>): number {
  const uniqueCommunities = new Set(communities.values());
  return uniqueCommunities.size;
}
