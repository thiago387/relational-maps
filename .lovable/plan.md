
## Fix: Sidebar Covered by Graph -- Stacking Context Fix

### The True Root Cause (Confirmed via Visual Reproduction)

I reproduced the bug at 768x1024 viewport. The CSS Grid tracks (`320px minmax(0, 1fr)`) are correctly sized, but the graph still visually covers the sidebar.

The reason: `clipPath: inset(0)` on `<main>` creates a **new stacking context**. In CSS painting order, later siblings render on top of earlier siblings. Since `<main>` comes AFTER `<aside>` in the DOM and has a stacking context (from clipPath), it paints on top of `<aside>`, which has no stacking context.

Even with `overflow: hidden`, the canvas content can briefly overflow before being clipped (during resize/repaint cycles), and the stacking order ensures it renders above the sidebar.

### The Fix: Explicit Stacking Order (2 class changes in Dashboard.tsx)

**Change 1** -- Give the `<aside>` element (desktop mode) `relative z-10` so it always renders ABOVE the main area:

```
Current (line 127):
: `${sidebarOpen ? 'border-r border-border bg-background overflow-hidden' : 'hidden'}`

Updated:
: `${sidebarOpen ? 'relative z-10 border-r border-border bg-background overflow-hidden' : 'hidden'}`
```

**Change 2** -- Give `<main>` a `z-0` to explicitly place it below the sidebar:

```
Current (line 175):
<main className="relative overflow-hidden min-w-0 min-h-0" style={{ clipPath: 'inset(0)' }}>

Updated:
<main className="relative z-0 overflow-hidden min-w-0 min-h-0" style={{ clipPath: 'inset(0)' }}>
```

### Why This Will Work

- `z-10` on aside creates a stacking context at z-index 10
- `z-0` on main creates a stacking context at z-index 0
- The aside will ALWAYS render on top of main, regardless of what the canvas does
- This works independently of overflow clipping -- even if the canvas overflows, the sidebar renders above it
- CSS Grid items fully support z-index for stacking order control

### Why Previous Fixes Failed

| Attempt | Why it failed |
|---------|--------------|
| `overflow: hidden` on main | Canvas paints at GPU level; stacking context from clipPath puts main above aside |
| `clip-path: inset(0)` | Creates stacking context that makes main paint OVER aside |
| `minmax(0, 1fr)` | Correctly sizes grid tracks but doesn't fix paint order |
| `contain: strict` | Broke grid row height calculation |
| `min-w-0` on flexbox | Flex items still had default stacking order issues |

### Files Changed

| File | Line | Change |
|------|------|--------|
| `src/components/dashboard/Dashboard.tsx` | 127 | Add `relative z-10` to desktop aside |
| `src/components/dashboard/Dashboard.tsx` | 175 | Add `z-0` to main element |

### What This Does NOT Touch
- Grid layout structure (stays as CSS Grid with `320px minmax(0, 1fr)`)
- NetworkGraph component (unchanged)
- Mobile sidebar behavior (unchanged, uses fixed positioning with z-50)
- Sidebar content (unchanged)
