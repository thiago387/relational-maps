

## Fix: Graph Overlapping Sidebar -- The Actual Root Cause

### Why Every Previous Fix Failed

All previous attempts (`z-index`, `isolation`, `clip-path`, `overflow: hidden`, `min-w-0` on flexbox, CSS Grid with `contain: strict`) failed because of **two compounding issues** that were never both addressed:

**Issue 1: CSS Grid `1fr` does NOT prevent content expansion**

When we write `gridTemplateColumns: '320px 1fr'`, the `1fr` is actually shorthand for `minmax(auto, 1fr)`. The `auto` minimum means the column will expand if its content is wider than the available space. The force-graph canvas, which starts at `window.innerWidth` pixels wide (confirmed in library source at line 1020), pushes the column wider than intended, causing it to overflow into the sidebar column.

The fix: use `minmax(0, 1fr)` instead of `1fr`. This sets the minimum column width to 0, preventing content from expanding the track.

**Issue 2: `contain: strict` breaks grid row sizing**

`contain: strict` includes `contain: size`, which tells the browser "this element has no intrinsic size." In a CSS Grid without explicit row heights, the row height is determined by content. With `contain: size`, the element reports 0 intrinsic height, which can cause the row (and thus the graph) to collapse or behave unpredictably. This needs to be removed and replaced with simpler overflow clipping.

### The Fix (2 files, 3 changes)

**File 1: `src/components/dashboard/Dashboard.tsx`**

Change 1 -- Fix grid template (line 111):
```
Current:  gridTemplateColumns: !isMobile && sidebarOpen ? '320px 1fr' : '1fr'
Updated:  gridTemplateColumns: !isMobile && sidebarOpen ? '320px minmax(0, 1fr)' : 'minmax(0, 1fr)'
```

Change 2 -- Fix main element styling (line 175):
```
Current:  <main className="relative overflow-hidden" style={{ contain: 'strict' }}>
Updated:  <main className="relative overflow-hidden min-w-0 min-h-0" style={{ clipPath: 'inset(0)' }}>
```

This replaces `contain: strict` (which breaks sizing) with:
- `min-w-0 min-h-0`: prevents the grid item from expanding beyond its track
- `clipPath: inset(0)`: GPU-level pixel clipping as a final safety net (works correctly now because the element will actually be the right size)

**File 2: `src/components/dashboard/NetworkGraph.tsx`**

Change 3 -- Don't render canvas until dimensions are known (around lines 160-182):
```tsx
// Current:
return (
    <div ref={containerRef} className="w-full h-full bg-background/30 rounded-lg overflow-hidden">
      <ForceGraph2D ... />
    </div>
);

// Updated:
return (
    <div ref={containerRef} className="w-full h-full bg-background/30 rounded-lg overflow-hidden">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ForceGraph2D ... />
      )}
    </div>
);
```

This prevents ForceGraph2D from mounting (and creating a canvas at `window.innerWidth`) before the ResizeObserver has measured the actual container size. The graph only renders once we know the correct dimensions.

### Why This Combination Will Work

| Problem | Fix | Why it works |
|---------|-----|-------------|
| Grid column expands beyond track | `minmax(0, 1fr)` | Sets hard minimum of 0px, column cannot grow beyond remaining space |
| Grid item expands beyond track | `min-w-0 min-h-0` | Prevents grid item from using content intrinsic size |
| Canvas paints outside bounds | `clipPath: inset(0)` | GPU-level clip (now effective because element is correctly sized) |
| Canvas initially renders at full viewport width | Conditional rendering | Canvas only created after correct dimensions are measured |
| `contain: strict` breaks row height | Removed | No more size containment interfering with grid layout |

### What This Does NOT Touch
- Graph rendering logic (nodes, links, forces) is unchanged
- Sidebar content and panels are unchanged
- Mobile sidebar behavior (fixed overlay) is unchanged
- No new dependencies or structural changes

