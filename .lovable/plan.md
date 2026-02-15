

## Fix: Sidebar Covered by Graph -- Structural Layout Overhaul

### Root Cause (confirmed via library source code)

After reading the force-graph library source (`node_modules/force-graph/dist/force-graph.mjs`), I found:

1. **The library defaults `width` to `window.innerWidth`** (line 1019-1020). Before the ResizeObserver in NetworkGraph.tsx fires and corrects the size, the canvas briefly renders at full viewport width.
2. **Flexbox `flex: 1` is content-influenced** -- even with `min-w-0`, the browser can temporarily allow the main element to exceed its allocated space during layout reflows triggered by canvas resizing.
3. **CSS `overflow: hidden` and `clip-path` are paint-level hints** that can be bypassed by canvas rendering in certain compositing scenarios, especially during resize transitions.

No amount of CSS clipping on the `main` element has worked because the problem is the **layout model** itself, not the visual clipping.

### Solution: Two changes

**Change 1: Switch from Flexbox to CSS Grid for the sidebar/main layout** (Dashboard.tsx)

CSS Grid gives the graph container an **explicit, content-independent size**. With `grid-template-columns: 320px 1fr`, the `1fr` column is mathematically constrained to `parent_width - 320px`. Unlike flexbox, grid cells cannot be expanded by their content -- the grid track size is absolute.

**Change 2: Set initial dimensions to 0 in NetworkGraph** (NetworkGraph.tsx)

Instead of defaulting to `{ width: 800, height: 600 }`, initialize to `{ width: 0, height: 0 }`. This prevents the canvas from rendering at a large size before the ResizeObserver has measured the actual container. The graph will only render once the container size is known.

### File Changes

**File 1: `src/components/dashboard/Dashboard.tsx`**

Replace the flex-based layout container (around lines 107-169) with CSS Grid:

```tsx
{/* Current: */}
<div className="flex-1 flex overflow-hidden relative min-w-0">
  {/* ... mobile backdrop ... */}
  <aside className={`
    ${isMobile
      ? 'fixed inset-y-0 left-0 z-50 w-80 bg-background shadow-lg transform transition-transform duration-200'
      : `flex-shrink-0 transition-all duration-200 ${sidebarOpen ? 'w-80 min-w-[320px] border-r border-border bg-background relative z-10' : 'w-0 min-w-0 border-r-0 overflow-hidden'}`
    }
    ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
  `}>
  {/* ... sidebar content ... */}
  </aside>
  <main className="flex-1 min-w-0 relative overflow-hidden isolate" style={{ clipPath: 'inset(0)' }}>
  {/* ... graph area ... */}
  </main>
</div>

{/* Updated: */}
<div
  className="flex-1 overflow-hidden relative"
  style={{
    display: 'grid',
    gridTemplateColumns: !isMobile && sidebarOpen ? '320px 1fr' : '1fr',
  }}
>
  {/* ... mobile backdrop (unchanged) ... */}
  <aside className={`
    ${isMobile
      ? 'fixed inset-y-0 left-0 z-50 w-80 bg-background shadow-lg transform transition-transform duration-200'
      : `${sidebarOpen ? 'border-r border-border bg-background overflow-hidden' : 'hidden'}`
    }
    ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
  `}>
  {/* ... sidebar content (unchanged) ... */}
  </aside>
  <main className="relative overflow-hidden" style={{ contain: 'strict' }}>
  {/* ... graph area (unchanged) ... */}
  </main>
</div>
```

Key aspects of this change:
- The parent uses `display: grid` with explicit column tracks instead of `display: flex`
- On desktop with sidebar open: `gridTemplateColumns: '320px 1fr'` -- sidebar gets exactly 320px, graph gets the rest
- On desktop with sidebar closed or mobile: `gridTemplateColumns: '1fr'` -- graph gets everything
- The sidebar no longer needs `flex-shrink-0`, `w-80`, `min-w-[320px]`, or `z-10` on desktop
- The main element uses `contain: strict` instead of `clip-path` and `isolate` -- this is the strongest CSS containment, preventing any content from rendering outside the element's bounds
- Mobile behavior (fixed sidebar with backdrop) is unchanged

**File 2: `src/components/dashboard/NetworkGraph.tsx`**

Change initial dimensions from 800x600 to 0x0:

```tsx
// Current (line 16):
const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

// Updated:
const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
```

This prevents the canvas from being created at a large default size. The ResizeObserver will set the correct dimensions on first measurement, and only then will the graph render.

### Why This Will Work

1. **CSS Grid is absolute** -- `320px` and `1fr` are not influenced by content. The graph container cannot exceed `viewport_width - 320px` regardless of what the canvas does.
2. **`contain: strict`** creates size + layout + paint containment. It is the strongest possible CSS containment, stronger than `clip-path + overflow: hidden + isolate` combined.
3. **Zero initial dimensions** prevent the race condition where the canvas renders at a large default size before the container is measured.

### What This Does NOT Touch
- NetworkGraph component logic (rendering, interaction, forces) is unchanged
- Mobile sidebar behavior (fixed overlay with backdrop) is unchanged
- Sidebar content and panels are unchanged
- No other files are modified

