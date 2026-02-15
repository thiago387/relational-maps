

## Fix: Sidebar Being Overlapped by Graph on Desktop

### Root Cause Analysis

After investigating, there are **three potential causes** all of which we will fix:

1. **Missing background color on desktop sidebar**: On line 120-121 of `Dashboard.tsx`, the mobile sidebar path includes `bg-background`, but the desktop path does not. Without an opaque background, the graph canvas (which uses an HTML5 canvas element) bleeds through visually.

2. **Missing z-index on desktop sidebar**: The sidebar and graph `main` area are flex siblings, but the `ForceGraph2D` canvas can paint over adjacent elements. The sidebar needs a `z-index` (e.g., `z-10`) to ensure it stacks above the graph area on desktop.

3. **Sidebar `overflow-hidden` applied inconsistently**: When the sidebar is open on desktop, it should clip its content properly but must not be transparent.

### Fix (all in `src/components/dashboard/Dashboard.tsx`)

Update the desktop sidebar classes (line 121) to add:
- `bg-background` -- gives the sidebar an opaque background so the graph cannot show through
- `z-10` -- ensures the sidebar visually stacks above the graph canvas
- Keep `overflow-hidden` only on the collapsed state (already correct)

Updated class logic:
```
Desktop open:   flex-shrink-0 w-80 border-r border-border bg-background z-10
Desktop closed: flex-shrink-0 w-0 border-r-0 overflow-hidden
Both:           transition-all duration-200
```

### Changes

| File | Change |
|------|--------|
| `src/components/dashboard/Dashboard.tsx` | Add `bg-background z-10` to the desktop sidebar open state classes (line 121) |

### What This Does NOT Touch
- The `NetworkGraph` component remains completely unchanged
- No changes to graph rendering, sizing, or behavior
- Mobile sidebar behavior unchanged

