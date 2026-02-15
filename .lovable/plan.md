

## Fix: Make Left Sidebar Responsive

### Problem
The sidebar is fixed at `w-80` (320px) with `flex-shrink-0`, so on narrow screens it takes up most of the viewport and gets cut off -- the content overflows and controls are clipped.

### Solution

Make the sidebar collapsible on mobile/tablet with a toggle button, and adjust its width to be responsive.

**Update `src/components/dashboard/Dashboard.tsx`:**

1. **Add a `sidebarOpen` state** (default `true` on desktop, `false` on mobile using the existing `useIsMobile` hook)
2. **On mobile (< 768px):** Render the sidebar as an overlay/drawer that slides in from the left with a hamburger toggle button in the header
3. **On desktop:** Keep the sidebar visible but allow collapsing with a toggle button
4. **Add a toggle button** in the header (hamburger icon from lucide-react: `Menu` / `PanelLeftClose`)
5. **Sidebar classes:** 
   - Mobile: `fixed inset-y-0 left-0 z-50 w-80 bg-background shadow-lg transform transition-transform` with translate based on open state
   - Desktop: `w-80 border-r` as before, but with a collapse option
6. **Add a backdrop overlay** on mobile when sidebar is open (click to close)

### Changes

| File | Change |
|------|--------|
| `src/components/dashboard/Dashboard.tsx` | Add sidebar toggle state, responsive sidebar with overlay on mobile, toggle button in header |

### Visual Result
- **Mobile/tablet:** Sidebar hidden by default, hamburger button in header opens it as a slide-over drawer with backdrop
- **Desktop:** Sidebar visible as before, with an optional collapse button
- All sidebar content remains fully accessible and scrollable at any screen size

