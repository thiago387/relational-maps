

## Fix: Make Sidebar a Fixed Overlay on All Viewports

After multiple failed attempts to make the sidebar coexist with the force-graph canvas in the same grid/flex layout, the simplest and most reliable solution is to **make the sidebar a fixed-position overlay on all viewports** (not just mobile). This completely removes the sidebar from document flow, so the graph canvas can never interfere with it.

### Approach

The sidebar will become a `fixed` positioned element that floats above the graph, exactly like how it already works on mobile. The graph will always take the full available width. The toggle button in the header will show/hide the sidebar with a slide-in animation.

### Changes (1 file: `src/components/dashboard/Dashboard.tsx`)

1. **Remove the CSS Grid layout entirely** -- the main content container becomes a simple full-width block since the graph always gets 100% width now.

2. **Make the sidebar `fixed` on ALL viewports** (not just mobile):
   - `fixed inset-y-0 left-0 z-50 w-80 bg-background shadow-lg`
   - Slide in/out with `translate-x` transition
   - Always renders above everything via `z-50`

3. **Add backdrop on all viewports** when sidebar is open (semi-transparent overlay behind sidebar, above graph).

4. **Simplify `<main>`** -- no more grid column placement, z-index, or clipPath needed. Just a simple full-size container.

### What the layout will look like

- **Sidebar closed**: Graph fills the entire area below the header. Menu button shows hamburger icon.
- **Sidebar open**: Graph still fills entire area. Sidebar slides in from the left as a fixed overlay with a backdrop behind it. Menu button shows X icon.

### Technical Details

```tsx
{/* Main content - graph takes full width always */}
<div className="flex-1 overflow-hidden relative">
  {/* Backdrop when sidebar is open */}
  {sidebarOpen && (
    <div
      className="fixed inset-0 z-40 bg-black/50"
      onClick={() => setSidebarOpen(false)}
    />
  )}

  {/* Graph area - full width, no grid constraints needed */}
  <main className="h-full w-full relative overflow-hidden">
    <div className="absolute inset-0 overflow-hidden">
      <NetworkGraph ... />
    </div>
    <DetailPanel ... />
  </main>

  {/* Sidebar - ALWAYS fixed overlay */}
  <aside
    className={`
      fixed inset-y-0 left-0 z-50 w-80 bg-background shadow-lg border-r border-border
      transform transition-transform duration-200
      ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    `}
  >
    <ScrollArea className="h-full">
      {/* ... all sidebar panels unchanged ... */}
    </ScrollArea>
  </aside>
</div>
```

### Why This Will Work (Guaranteed)

- `fixed` positioning removes the sidebar from document flow entirely -- it cannot be affected by anything the graph canvas does
- `z-50` ensures it renders above everything
- No CSS Grid or flexbox interaction between sidebar and graph
- This is the exact same pattern already working on mobile -- we're just using it on all viewports

### What This Does NOT Touch
- Sidebar content (all panels remain identical)
- NetworkGraph component (unchanged)
- Header (unchanged, toggle button works the same way)
- Mobile behavior (already uses this pattern, so it stays the same)
