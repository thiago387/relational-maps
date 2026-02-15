

## Fix: Sidebar Content Horizontally Clipped on Desktop

### Investigation Findings

After thorough analysis of the component hierarchy, here are all identified causes:

**1. No `min-width` on the sidebar aside element**
The sidebar uses `w-80` (320px) but lacks `min-w-80`. In a flex layout, even with `flex-shrink-0`, some browsers can still compress the element if sibling content (the canvas) is aggressive about space. Adding `min-w-[320px]` guarantees the sidebar never gets squeezed below its intended width.

**2. The `<main>` graph container lacks `overflow: hidden` containment for the canvas**
The `ForceGraph2D` component renders an HTML5 `<canvas>` element. The `<main>` has `overflow-hidden`, but the canvas dimensions are set explicitly via `width` and `height` props from a `ResizeObserver`. If the observer fires before the sidebar is factored into the layout, the canvas may be sized to the full viewport width, visually overlapping the sidebar.

**3. `position: relative` needed on the sidebar**  
The sidebar has `z-10` but no `position` property set. In CSS, `z-index` only works on positioned elements (`relative`, `absolute`, `fixed`). Without `position: relative`, the `z-10` class has no effect and the canvas can paint over the sidebar.

### Plan

All changes in `src/components/dashboard/Dashboard.tsx`:

Update the desktop sidebar classes (line 121) to add:
- `relative` -- makes `z-10` actually take effect
- `min-w-[320px]` -- prevents flex from squeezing sidebar below intended width
- Keep everything else the same

Updated desktop open class string:
```
flex-shrink-0 transition-all duration-200 w-80 min-w-[320px] border-r border-border bg-background relative z-10
```

Updated desktop closed class string (add `min-w-0` to allow collapsing):
```
flex-shrink-0 transition-all duration-200 w-0 min-w-0 border-r-0 overflow-hidden
```

### What This Does NOT Touch
- NetworkGraph component remains completely unchanged
- Mobile sidebar behavior unchanged
- No changes to graph rendering or sizing

