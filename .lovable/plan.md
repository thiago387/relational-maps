

## Fix: Sidebar Fully Visible - Stop Graph Canvas From Overlapping

### Problem
Despite adding `bg-background`, `relative`, `z-10`, and `min-w-[320px]` to the sidebar, the graph canvas still visually paints over the right portion of the sidebar. This is because `ForceGraph2D` (react-force-graph-2d) renders an HTML5 canvas that can visually bleed across flex siblings even with overflow-hidden, depending on browser compositing.

### Root Cause
The `<main>` element containing the graph and the `<aside>` sidebar are flex siblings. While the sidebar has `z-10`, the `<main>` element does not have a contained stacking context that prevents its canvas child from painting over adjacent elements. CSS `isolation: isolate` on the `<main>` forces a new stacking context, guaranteeing that nothing inside `<main>` can visually escape and overlap the sidebar.

### Solution (all in `src/components/dashboard/Dashboard.tsx`)

**Change 1 - Add `isolate` to `<main>` (line 169)**

This CSS property creates a new stacking context on the graph container, preventing the canvas from visually overlapping the sidebar regardless of internal z-index values.

Current:
```
<main className="flex-1 relative overflow-hidden">
```

Updated:
```
<main className="flex-1 relative overflow-hidden isolate">
```

**Change 2 - Ensure sidebar z-index is effective (line 121)**

Keep the existing `relative z-10 bg-background min-w-[320px]` classes on the desktop open state (already present from last edit). No change needed here.

### Why This Should Work
- `isolate` on `<main>` creates a stacking context boundary -- the canvas inside cannot have a z-index higher than `<main>` itself relative to its siblings
- The sidebar with `relative z-10` will always stack above the default-stacking `<main>` (which has no z-index set, effectively `z-index: auto`)
- The graph component itself is not modified at all

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/Dashboard.tsx` | Add `isolate` class to `<main>` element (line 169) |

