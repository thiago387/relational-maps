
## Fix: Community Buttons Overflowing Sidebar Horizontally

The community buttons container uses `flex-wrap` but has no explicit width constraint. The parent `<div className="space-y-6 p-4 bg-card rounded-lg border border-border">` doesn't enforce a max-width on its children, so the flex row of buttons extends past the sidebar edge instead of wrapping.

### Root Cause

The FilterPanel's outer container and the communities `div` both lack `overflow-hidden` and explicit width constraints. Flex-wrap only works when the container has a defined width -- without one, items just keep flowing horizontally.

### Fix (1 file: `src/components/dashboard/FilterPanel.tsx`)

1. **Add `overflow-hidden` to the FilterPanel root container** (line 72) to prevent any child from bleeding out:
   ```
   Current:  <div className="space-y-6 p-4 bg-card rounded-lg border border-border">
   Updated:  <div className="space-y-6 p-4 bg-card rounded-lg border border-border overflow-hidden">
   ```

2. **Add `w-full` and `overflow-hidden` to the communities wrapper** (line 243) so flex-wrap is forced to wrap within the available width:
   ```
   Current:  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
   Updated:  <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto w-full overflow-x-hidden">
   ```
   Also increased `max-h-32` to `max-h-48` to show more rows (about 5 rows visible before scrolling).

These two changes ensure the buttons are forced to wrap within the sidebar width and any overflow is clipped.
