
## Fix: Community Buttons Horizontal Overflow (Root Cause)

The Radix ScrollArea Viewport internally sets `overflow: scroll` on both axes, giving children an unbounded horizontal content area. This prevents `flex-wrap` from ever triggering on the 108 community buttons.

### 3 Targeted Changes

**1. `src/components/ui/scroll-area.tsx` (line 11) -- Kill horizontal scroll on Viewport**

Add an inline style to override Radix's internal `overflow: scroll` on the X axis:
```
Current:  <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
Updated:  <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]" style={{ overflowX: 'hidden' }}>
```

**2. `src/components/dashboard/Dashboard.tsx` (line 147) -- Belt-and-suspenders on inner div**

Add `overflow-hidden` to prevent any child from pushing beyond 640px:
```
Current:  <div className="p-4 space-y-4 min-w-0 w-full">
Updated:  <div className="p-4 space-y-4 min-w-0 w-full overflow-hidden">
```

**3. `src/components/dashboard/FilterPanel.tsx` (line 243) -- Add `max-w-full` safety net**

Ensure the badge container cannot exceed its parent's width:
```
Current:  <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto w-full overflow-x-hidden">
Updated:  <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto w-full max-w-full overflow-x-hidden">
```

### Why Previous Fixes Failed

`min-w-0` says "I'm allowed to shrink" but nothing forced it to shrink -- the Radix Viewport was expanding to fit intrinsic content width. Change 1 is the real fix; changes 2 and 3 are defense-in-depth.

| File | Line | Change |
|------|------|--------|
| scroll-area.tsx | 11 | Add `style={{ overflowX: 'hidden' }}` to Viewport |
| Dashboard.tsx | 147 | Add `overflow-hidden` to sidebar inner div |
| FilterPanel.tsx | 243 | Add `max-w-full` to communities container |
