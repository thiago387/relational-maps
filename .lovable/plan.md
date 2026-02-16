

## Make Community Questions Robust in the Chatbot

### Problem
Community detection runs entirely client-side using the Louvain algorithm on edges. The `persons` table is empty, so the edge function has zero community data. When a user asks "tell me about community 3," the AI has no information to answer with.

### Solution
Two-part fix:
1. **Port community detection into the edge function** so it can run Louvain on the 2,611 edges in the database when a community question is detected
2. **Add a `community_analysis` intent** to the orchestrator so community-specific questions get dedicated, rich data fetching

### Changes

#### File: `supabase/functions/chat-analysis/index.ts`

**1. Add `community_analysis` to the orchestrator's intent enum**

Update the `plan_response` tool definition (line 87) to include `"community_analysis"` alongside the existing intents. Add a `community_ids` parameter (array of integers) for when the user references specific communities.

**2. Add inline Louvain community detection function**

Port the existing `detectCommunities` algorithm from `src/lib/communityDetection.ts` into the edge function as a helper function. This is a pure algorithm with no browser dependencies, so it ports directly.

**3. Add community data fetching block**

When `community_analysis` is in the plan's intents:

- Fetch all edges from the `edges` table (2,611 rows -- manageable)
- Run Louvain community detection on them to get `personId -> communityId` mapping
- For each requested community (or all if none specified):
  - List all members (person IDs/emails) in that community
  - Count internal edges (both endpoints in same community) vs external edges
  - Calculate average polarity of internal communications
  - Identify the top communicator (highest total message count)
  - Identify bridge nodes (members with edges to other communities)
  - Collect sentiment distribution (positive/negative/neutral edge counts)
- Format this as a structured context block for the analyst

**4. Enhance general stats with community summary**

In the existing `general` intent block, after fetching edges count, also run community detection and add a brief summary: number of communities, largest community size, smallest community size. This gives the AI baseline community awareness even for general questions.

### Data Context Format (example for community 3)

```
COMMUNITY ANALYSIS: Community 3 (14 members)

Members:
- alice@example.com (sent: 45, received: 32)
- bob@example.com (sent: 28, received: 19)
- ...

Internal Communication:
- Internal edges: 22, External edges: 18
- Internal message volume: 340
- Avg internal polarity: 0.15 (leaning positive)

Sentiment Distribution:
- Positive edges: 14 (63.6%)
- Negative edges: 3 (13.6%)
- Neutral edges: 5 (22.7%)

Key Figures:
- Top communicator: alice@example.com (77 total messages)
- Bridge nodes: charlie@example.com (connects to communities 1, 5)

Cross-Community Connections:
- Community 1: 8 edges (strongest link)
- Community 5: 3 edges
```

### Technical Notes

- The Louvain algorithm is O(n * edges * iterations), with ~2,600 edges and max 20 iterations this completes in milliseconds
- Community IDs are deterministic for the same edge set, so they match what the user sees on the graph
- The edge function fetches all 2,611 edges in a single query (well within Supabase limits)
- No database schema changes needed -- everything is computed on-the-fly from the existing `edges` table

### Files Modified
- `supabase/functions/chat-analysis/index.ts` -- add community_analysis intent, inline Louvain algorithm, community data fetching logic

