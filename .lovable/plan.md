

## Fix: Sidebar Covered by Graph -- Use Hard Pixel Clipping

### Why All Previous Fixes Failed

We have tried: `z-index`, `isolation: isolate`, `bg-background`, `min-width`, `position: relative`, and `absolute inset-0 overflow-hidden` wrapper. The graph canvas still bleeds over the sidebar.

The root cause is that CSS `overflow: hidden` does not always prevent an HTML5 canvas from painting outside its container. The `ForceGraph2D` library renders directly to a canvas element with explicit pixel dimensions, and browser compositing can allow those pixels to appear outside the `overflow: hidden` boundary in certain flex layout scenarios.

### Solution: `clip-path: inset(0)` on the graph container

The CSS property `clip-path: inset(0)` creates a **hard pixel-level clip** at the GPU compositing layer. Unlike `overflow: hidden` (which is a layout-level hint that can be bypassed), `clip-path` physically prevents any pixel from rendering outside the element's bounds. This is the nuclear option that is guaranteed to work.

### Changes (single file)

**File: `src/components/dashboard/Dashboard.tsx`**

Update the `<main>` element (the graph area container) to add an inline style for `clipPath`:

Current (around line 169):
```tsx
<main className="flex-1 relative overflow-hidden isolate">
```

Updated:
```tsx
<main className="flex-1 relative overflow-hidden isolate" style={{ clipPath: 'inset(0)' }}>
```

That is the only change. One attribute added to one element.

### Why This Will Work

- `clip-path: inset(0)` creates a clipping rectangle at the exact bounds of the element
- It operates at the GPU compositing level, meaning no child element (canvas, SVG, or otherwise) can render pixels outside the clip region
- This is fundamentally different from `overflow: hidden`, which only affects layout overflow and can be bypassed by certain rendering pipelines
- Browser support for `clip-path: inset()` is universal in modern browsers

### What This Does NOT Touch
- NetworkGraph component is unchanged
- Sidebar classes are unchanged
- Mobile behavior is unchanged
- The absolute wrapper div remains for additional safety
- No other files are modified

