

## Fix: Sidebar Covered by Graph -- The Real Root Cause

### Why ALL Previous Fixes Failed

We tried `z-index`, `isolation: isolate`, `clip-path: inset(0)`, `overflow: hidden`, and absolute wrapping. None worked because they all try to clip content WITHIN the `<main>` element. But the problem is that **`<main>` itself is too wide** and physically overlaps the sidebar.

### The Actual Root Cause: Flexbox `min-width: auto`

In CSS flexbox, flex items have `min-width: auto` by default. This means a flex item will **never shrink below its content's intrinsic size**, even with `flex: 1`.

The `ForceGraph2D` canvas has a large intrinsic width (set via HTML attributes). Because `<main>` has no `min-width: 0`, it refuses to shrink to the remaining space after the sidebar, and instead expands to accommodate the canvas -- overlapping the sidebar.

This is a well-documented flexbox gotcha. The fix is adding `min-w-0` (which sets `min-width: 0`) to allow the flex item to shrink properly.

### Changes (single file: `src/components/dashboard/Dashboard.tsx`)

**Change 1 -- Add `min-w-0` to `<main>` (line 169)**

```
Current:
<main className="flex-1 relative overflow-hidden isolate" style={{ clipPath: 'inset(0)' }}>

Updated:
<main className="flex-1 min-w-0 relative overflow-hidden isolate" style={{ clipPath: 'inset(0)' }}>
```

**Change 2 -- Add `min-w-0` to the parent flex container (line 107)**

The parent also needs this to prevent the same issue from propagating up:

```
Current:
<div className="flex-1 flex overflow-hidden relative">

Updated:
<div className="flex-1 flex overflow-hidden relative min-w-0">
```

### Why This Will Work

- `min-w-0` overrides the default `min-width: auto` behavior
- This allows `flex: 1` to actually shrink the `<main>` element to fit the remaining space after the 320px sidebar
- The canvas ResizeObserver will then measure the correct (smaller) container size
- The canvas will render at the correct dimensions, not overlapping the sidebar
- The existing `clip-path` and `overflow-hidden` remain as safety nets

### Technical Details

| File | Line | Change |
|------|------|--------|
| `src/components/dashboard/Dashboard.tsx` | 107 | Add `min-w-0` to parent flex container |
| `src/components/dashboard/Dashboard.tsx` | 169 | Add `min-w-0` to `<main>` element |

### What This Does NOT Touch
- NetworkGraph component is unchanged
- Sidebar classes are unchanged
- Mobile behavior is unchanged
- No other files are modified

