

## Fix: Sidebar Fully Visible -- Contain Graph Canvas with Absolute Positioning

### Why Previous Fixes Did Not Work

All previous attempts (z-index, isolation, bg-background, min-width) addressed stacking order, but the fundamental problem is that the ForceGraph2D canvas is not being clipped by `overflow: hidden` on the `<main>` element. This can happen when the library's internal DOM structure (it creates its own container with `position: relative`) interacts with the flex layout in a way that allows the canvas to paint outside its parent's visual bounds.

### Solution

Wrap the NetworkGraph component inside an absolutely-positioned div that is physically bounded within the `<main>` element. An absolutely-positioned element with `inset: 0` (top/right/bottom/left all 0) is guaranteed to be contained within its positioned parent, and `overflow: hidden` on it will clip the canvas no matter what.

### Changes (single file: `src/components/dashboard/Dashboard.tsx`)

**Wrap NetworkGraph in an absolute container (around line 169-175):**

Current:
```jsx
<main className="flex-1 relative overflow-hidden isolate">
  <NetworkGraph
    data={graphData}
    onNodeClick={handleNodeClick}
    onLinkClick={handleLinkClick}
    selectedNodeId={selectedNode?.id}
  />
  
  <DetailPanel ... />
</main>
```

Updated:
```jsx
<main className="flex-1 relative overflow-hidden isolate">
  <div className="absolute inset-0 overflow-hidden">
    <NetworkGraph
      data={graphData}
      onNodeClick={handleNodeClick}
      onLinkClick={handleLinkClick}
      selectedNodeId={selectedNode?.id}
    />
  </div>
  
  <DetailPanel ... />
</main>
```

### Why This Will Work

- `absolute inset-0` makes the wrapper exactly match the `<main>` element's bounds (which has `position: relative`)
- `overflow: hidden` on this wrapper clips the canvas -- even if the canvas tries to render outside, it is physically impossible for pixels to escape
- The DetailPanel remains outside this wrapper so it floats above the graph as before
- The NetworkGraph component and its internal ResizeObserver are untouched -- the container still fills the available space

### What This Does NOT Touch
- NetworkGraph component code is unchanged
- Sidebar classes are unchanged
- Mobile behavior is unchanged
- Graph rendering, interactions, and sizing are unchanged

