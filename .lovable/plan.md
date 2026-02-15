

## Fix: Make Node Names Always Visible

### Problem
Node labels are hidden at default zoom because of the condition `if (globalScale > 0.5)` on line 87 of `NetworkGraph.tsx`. At the initial zoom level showing all nodes, the scale is below this threshold, so no names appear.

### Solution

**Update `src/components/dashboard/NetworkGraph.tsx`:**

1. **Remove or lower the zoom threshold** -- always render labels regardless of zoom level. Change `globalScale > 0.5` to `globalScale > 0.15` (or remove the condition entirely).

2. **Add a text outline/stroke** for readability against the graph background:
   - Use `ctx.strokeText()` with a dark stroke before `ctx.fillText()` with white fill
   - This creates a readable label on any background color

3. **Scale font size better** -- adjust the font calculation so labels are legible at default zoom but don't become huge when zoomed in:
   - Change from `Math.max(12 / globalScale, 3)` to `Math.max(10 / globalScale, 2)` with an upper cap

### Changes

| File | Change |
|------|--------|
| `src/components/dashboard/NetworkGraph.tsx` | Lower zoom threshold to ~0.15, add text outline stroke for contrast, adjust font sizing |

### Visual Result
- All node names visible at default zoom
- Dark outline around white text ensures readability over any edge/node color
- Labels scale appropriately when zooming in/out
