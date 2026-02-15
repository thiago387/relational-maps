

## Plan: Cluster Analysis Feature

### Problem

The current community detection uses a basic **connected components** algorithm (BFS), which only finds disconnected subgraphs. In a densely connected email network, this likely produces just 1-2 giant components -- not meaningful clusters. We need a proper clustering algorithm and a dedicated cluster explorer in the dashboard.

### Phase 1: Implement Louvain-Style Community Detection

**Update `src/lib/communityDetection.ts`:**

Replace the BFS connected-components algorithm with a **modularity-based Louvain algorithm** that finds densely connected sub-groups within a single connected component.

The algorithm works by:
1. Starting with each node in its own community
2. Iteratively moving nodes to the neighboring community that gives the largest modularity gain
3. Repeating until no more improvements can be made

This will produce meaningful clusters like "legal team", "personal contacts", "financial associates" instead of just "everyone is in community 0".

The existing `detectCommunities` function signature stays the same (`edges -> Map<string, number>`) so no downstream changes are needed for the graph builder.

### Phase 2: Create Cluster Explorer Panel

**Create `src/components/dashboard/ClusterPanel.tsx`:**

A new panel component that shows:
- List of all detected clusters with member count and average sentiment
- Top members per cluster (by email volume)
- Cluster-level stats: internal vs external connections, dominant sentiment
- Click on a cluster to filter the graph to show only that cluster's members

```
+-----------------------------------------------+
|  Clusters (7 detected)                        |
+-----------------------------------------------+
|  [#0 Blue]  12 members  |  Avg: +0.32         |
|    Top: KathyRuemmler, jeevacation, ...        |
|    Internal: 145 edges | External: 38 edges    |
+-----------------------------------------------+
|  [#1 Green]  8 members  |  Avg: -0.12         |
|    Top: RobertTrivers, AlexFamilyPines, ...    |
|    Internal: 67 edges  | External: 22 edges    |
+-----------------------------------------------+
|  [#2 Purple] 5 members  |  Avg: +0.45         |
|    ...                                         |
+-----------------------------------------------+
```

Each cluster card is clickable to filter the graph and highlight that community.

### Phase 3: Integrate Cluster Panel into Dashboard

**Update `src/components/dashboard/Dashboard.tsx`:**

- Compute cluster summary data from `graphData` (group nodes by `communityId`, calculate stats)
- Add a "Clusters" tab or section in the left sidebar between FilterPanel and StatsPanel
- Wire up click handlers to set `filters.selectedCommunities`

**Update `src/hooks/useGraphData.ts`:**

- Derive `communities` from the graph nodes' `communityId` (from edge-based detection) instead of the legacy `persons.community_id`
- Export cluster metadata (member list, stats) for the ClusterPanel

### Phase 4: Update FilterPanel Community Buttons

**Update `src/components/dashboard/FilterPanel.tsx`:**

- Accept community data derived from edges (not legacy `persons`) 
- Show community member count next to each color button
- Currently the `communities` prop comes from `persons.community_id` which is always null for edge-based data -- fix this to use the detected communities from graph nodes

### Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `src/lib/communityDetection.ts` | Modify | Replace BFS with Louvain modularity algorithm |
| `src/components/dashboard/ClusterPanel.tsx` | Create | Cluster explorer with stats, member lists, click-to-filter |
| `src/components/dashboard/Dashboard.tsx` | Modify | Add ClusterPanel, compute cluster summary data |
| `src/hooks/useGraphData.ts` | Modify | Derive communities from edges instead of legacy persons |
| `src/components/dashboard/FilterPanel.tsx` | Modify | Use edge-derived communities with member counts |

### Technical Details

**Louvain Algorithm Implementation:**

```text
Input: weighted graph (edges with message_count)
Output: Map<nodeId, communityId>

1. Initialize: each node = its own community
2. For each node:
   a. Calculate modularity gain of moving to each neighbor's community
   b. Move to community with highest positive gain
3. Repeat step 2 until no moves improve modularity
4. (Optional) Aggregate communities into super-nodes and repeat
```

Key considerations:
- Use `message_count` as edge weight for modularity calculation
- Run on merged edges (after normalization) for accuracy
- Cache results since the algorithm is deterministic for same input
- Expected output: 5-15 meaningful clusters depending on the data density

**Cluster Summary Data Structure:**

```typescript
interface ClusterSummary {
  id: number;
  color: string;
  memberCount: number;
  members: { id: string; emailCount: number }[];
  avgSentiment: number | null;
  internalEdges: number;   // edges within cluster
  externalEdges: number;   // edges to other clusters
  totalMessages: number;
}
```

