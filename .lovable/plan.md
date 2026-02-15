

## Fix: Desktop Sidebar Collapse

### Problem
The sidebar toggle button works on mobile (slide-over drawer) but on desktop, the collapse logic is ignored. Line 123 checks `isMobile && !sidebarOpen`, so on desktop the sidebar always stays visible at 320px wide regardless of the toggle state.

### Solution

Update the sidebar classes in `src/components/dashboard/Dashboard.tsx` so that on desktop, when `sidebarOpen` is false, the sidebar collapses to `w-0` (or is hidden) with a smooth transition:

1. **Desktop closed state**: When `!sidebarOpen` on desktop, set width to 0 and hide overflow so the sidebar fully collapses and the graph gets the full viewport width
2. **Desktop open state**: Keep `w-80 border-r` as before
3. **Add transition on desktop** for smooth open/close animation (`transition-all duration-200`)

The updated aside classes logic:

```
Desktop open:   w-80 border-r border-border flex-shrink-0
Desktop closed: w-0 border-r-0 flex-shrink-0 overflow-hidden
Mobile open:    fixed inset-y-0 left-0 z-50 w-80 ... translate-x-0
Mobile closed:  fixed inset-y-0 left-0 z-50 w-80 ... -translate-x-full
```

Both desktop and mobile get `transition-all duration-200` for smooth animation.

### Changes

| File | Change |
|------|--------|
| `src/components/dashboard/Dashboard.tsx` | Fix sidebar classes so desktop respects the `sidebarOpen` toggle -- collapse to `w-0` when closed, `w-80` when open, with transition |

