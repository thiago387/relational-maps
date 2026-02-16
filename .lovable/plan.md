

## Timeline Panel Enhancements

### Overview

Two improvements to the Timeline panel: community-based filtering and color-coded sentiment shifts (red for declining sentiment).

---

### Change 1: Community Filtering

**Problem**: The timeline shows all emails regardless of the selected community filter in the dashboard.

**Solution**: Pass the `graphData.nodes` (which carry `communityId`) and `filters.selectedCommunities` into `TimelinePanel`. Before aggregating, filter emails by checking if their `sender_id` belongs to a node in one of the selected communities.

**In `TimelinePanel.tsx`**:
- Add `graphNodes: GraphNode[]` to props
- Build a `Map<string, number | null>` from `graphNodes` mapping node ID to communityId
- When `filters.selectedCommunities` is non-empty, skip emails whose `sender_id` is not in a selected community

**In `Dashboard.tsx`**:
- Pass `graphNodes={graphData.nodes}` to `<TimelinePanel />`

---

### Change 2: Sentiment Color Gradient on the Line

**Problem**: The sentiment line is always green, making it hard to see negative periods.

**Solution**: Replace the single `<Line>` with a Recharts `<Area>` that uses a vertical SVG gradient (`<linearGradient>`) mapped to the sentiment Y-axis:
- Values above 0 render in green
- Values below 0 render in red
- The gradient stop is placed at the 50% mark (which maps to 0 on the -1 to 1 domain)

Additionally, add colored reference dots: each data point on the sentiment line gets a custom dot renderer that colors individual dots green (positive) or red (negative), giving an immediate visual signal.

**In `TimelinePanel.tsx`**:
- Add a `<defs>` block inside `<ComposedChart>` with a `<linearGradient>` going from green (top, sentiment=1) through neutral at the midpoint to red (bottom, sentiment=-1)
- Change the sentiment `<Line>` to use `stroke="url(#sentimentGradient)"` or switch to an `<Area>` with gradient fill
- Add a custom `dot` renderer that returns a circle colored green or red based on the point's `avgSentiment` value
- Update the tooltip to show sentiment value with a colored indicator

---

### Technical Details

| Item | Detail |
|------|--------|
| Files modified | `src/components/dashboard/TimelinePanel.tsx`, `src/components/dashboard/Dashboard.tsx` |
| New dependencies | None -- uses existing Recharts SVG capabilities |
| Performance | Minimal -- just one extra filter pass over emails array |

### Changes Summary

**`TimelinePanel.tsx`**:
- Add `graphNodes` prop and build community lookup map
- Filter emails by selected communities before aggregating
- Add SVG `linearGradient` definition for green-to-red sentiment coloring
- Add custom dot renderer that colors each point by its sentiment value
- Enhance tooltip to show colored sentiment indicator

**`Dashboard.tsx`**:
- Pass `graphNodes={graphData.nodes}` to `<TimelinePanel />`

