
## Fix: Community Buttons Overflowing Sidebar

The 108 community buttons in the "Communities" section use `flex flex-wrap gap-1` but each button has enough padding (`px-2 py-1`) that they extend beyond the sidebar width. The container has no max-width or overflow constraint, so the row of buttons pushes past the sidebar boundary.

### Changes (1 file: `src/components/dashboard/FilterPanel.tsx`)

**Make the community buttons grid denser and contained:**

1. **Wrap in a scroll container with max-height** -- Add `max-h-32 overflow-y-auto` to the community buttons container so it scrolls vertically instead of expanding indefinitely.

2. **Make buttons smaller** -- Reduce padding from `px-2 py-1` to `px-1.5 py-0.5` and reduce text from `text-xs` to `text-[10px]`. This fits ~5 rows of buttons in the visible area.

3. **Add `overflow-hidden` on the outer communities section** to prevent any horizontal bleed.

```
Current (line 243):
<div className="flex flex-wrap gap-1">

Updated:
<div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
```

```
Current (lines 248-249):
"px-2 py-1 rounded-full text-xs font-medium transition-all",

Updated:
"px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all",
```

This keeps all 108 communities accessible (via scrolling) while fitting neatly within the sidebar width. The smaller pill size means ~20-25 buttons per row, giving roughly 4-5 compact rows in the visible 128px area.

### Files Changed

| File | Lines | Change |
|------|-------|--------|
| `src/components/dashboard/FilterPanel.tsx` | 243 | Add `max-h-32 overflow-y-auto` to container |
| `src/components/dashboard/FilterPanel.tsx` | 249 | Reduce button padding and text size |
