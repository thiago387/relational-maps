

## Auto-Generated Cluster Names and Descriptions

### Overview

Add an auto-generated name and short description to each cluster card in the Cluster Panel. Since clusters are computed dynamically (Louvain algorithm, 108 clusters), names and descriptions will be derived from each cluster's characteristics -- no manual labeling needed.

---

### Naming Strategy

Each cluster gets a name based on its **top member** (the person with the highest email count), displayed as a human-readable label:
- Extract the local part of the top member's email/ID (e.g., `jeevacation@gmail.com` becomes `Jeevacation`)
- Format: **"Jeevacation Circle"** or **"KathyRuemmler Group"**
- For single-member clusters: just the member name

### Description Strategy

A short one-line description derived from structural characteristics:
- **Size**: "Large hub" (50+), "Mid-size group" (10-49), "Small circle" (3-9), "Pair" (2)
- **Sentiment**: "positive tone", "negative tone", "neutral tone", or "mixed tone"
- **Connectivity pattern**: "mostly internal" (internal > 2x external), "outward-facing" (external > 2x internal), "balanced connections"

Example outputs:
- **"Jeevacation Circle"** -- *Large hub with negative tone, outward-facing*
- **"TerryKafka Group"** -- *Mid-size group with positive tone, mostly internal*
- **"RobertTrivers Circle"** -- *Mid-size group with negative tone, balanced connections*

---

### UI Changes

In the cluster card (the button element), add the name and description **between the header row and the member list**, keeping all existing information intact:

```
[dot] Jeevacation Circle  362 members    [sentiment] 0.24
Large hub with positive tone, outward-facing
jeevacation@gmail.com, KathyRuemmler, MichaelWolff +359 more
[arrow] 498 internal  149 external  6416 msgs
```

The name replaces "Cluster #0" in the existing header. The description appears as a new italic/muted line below the header.

---

### Technical Details

**File modified**: `src/components/dashboard/ClusterPanel.tsx` only

- Add a `generateClusterName(cluster: ClusterSummary)` function:
  - Takes the top member ID, extracts readable name (split on `@`, capitalize first letter)
  - Appends "Circle" for small clusters, "Group" for medium, "Network" for large (50+)

- Add a `generateClusterDescription(cluster: ClusterSummary)` function:
  - Builds a short phrase from size category + sentiment label + connectivity pattern
  - Returns a string like "Large hub with negative tone, outward-facing"

- Update the `ClusterSummary` interface: no changes needed (name/description are derived, not stored)

- In the JSX:
  - Replace `Cluster #{cluster.id}` with the generated name
  - Add a new `<div>` with the description text (styled as `text-[11px] italic text-muted-foreground`)
  - All other elements (member list, sentiment indicator, edge stats) remain unchanged

### No other files are affected.

