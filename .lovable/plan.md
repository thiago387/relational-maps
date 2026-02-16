

## Widen Sidebar from 320px to 640px

The sidebar is currently `w-80` (320px), which cuts the content boxes in half. Doubling it to `w-[640px]` will give all panels enough room to display fully.

### Change (1 file)

**`src/components/dashboard/Dashboard.tsx`** -- Update the sidebar width class:

```
Current:  fixed inset-y-0 left-0 z-50 w-80 bg-background ...
Updated:  fixed inset-y-0 left-0 z-50 w-[640px] bg-background ...
```

That is the only change needed. All sidebar panel content will automatically reflow to fill the wider container.

