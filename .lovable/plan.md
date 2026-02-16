

## Fix: Topics Disappear When Community Filter Is Applied

### Root Cause

`TopicsPanel` receives `graphNodes={graphData.nodes}` from the Dashboard. But `graphData.nodes` are **already filtered** by the community selection -- they only contain nodes visible on the graph after filtering.

When `TopicsPanel` then tries to filter emails by community using this map, most `sender_id` values don't exist in the map (because the graph nodes were already pruned). The result: nearly all emails get filtered out, and the topic list goes empty.

### Fix

Pass the **full, unfiltered edges list** to `TopicsPanel` instead of the filtered graph nodes. Build the community map from the raw edges data, which always contains all senders regardless of active filters.

### Changes

**File: `src/components/dashboard/Dashboard.tsx`**
- Pass `edges` (the raw, unfiltered edges array from `useGraphData`) to `TopicsPanel` instead of (or alongside) `graphNodes`

**File: `src/components/dashboard/TopicsPanel.tsx`**
- Accept a new `edges` prop (the full edge list)
- Import and run `detectCommunities` on the full edge set to build an unfiltered sender-to-community map
- Use that map for the community filter instead of the one derived from filtered `graphNodes`
- Remove the `graphNodes` prop dependency for community mapping

**File: `src/hooks/useGraphData.ts`**
- No changes needed -- `edges` is already exported and always contains the full dataset

### Why This Works

The `edges` array from the data hook is never filtered by community. Running community detection on it produces a complete mapping of every sender to their community. When a user selects a community filter, the `TopicsPanel` can then correctly identify which emails belong to that community and show the right topics.

### Technical Detail

```text
Before (broken):
  edges --> buildGraphFromEdges(filters) --> filtered nodes --> TopicsPanel
  TopicsPanel sees only nodes in selected community, misses email senders

After (fixed):
  edges (unfiltered) --> TopicsPanel --> detectCommunities(all edges) --> full community map
  TopicsPanel correctly matches all email senders to their community
```

