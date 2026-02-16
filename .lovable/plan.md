

## Make Previous Conversations Accessible

### Problem
Conversations are only accessible via a small Select dropdown in the chat header, which is easy to miss. Users need a clear, dedicated way to browse and access their conversation history.

### Solution
Add a conversation history list view that shows when the chat opens (if no active conversation) or when the user clicks a History button. Replace the dropdown with a more prominent UI.

### Changes

**File: `src/components/dashboard/ChatPanel.tsx`**

1. **Add `showHistory` state** -- defaults to `true` when chat opens with no active conversation
2. **Add a History button** (clock icon) in the header next to the New/Close buttons
3. **Add a conversation list view** that renders when `showHistory` is true:
   - Each conversation shown as a clickable card with title (truncated) and relative timestamp using `formatDistanceToNow` from `date-fns`
   - Clicking a card sets that conversation as active and exits history view
   - "New Analysis" button at the top of the list
   - Empty state message when no conversations exist
4. **Remove the Select dropdown** from the header (replaced by the history list view)
5. **Auto-show history** when chat opens and there's no active conversation but conversations exist
6. **Header simplification**: Show conversation title as plain text when in a conversation, with History / New / Close buttons

### UI Layout

```text
+----------------------------------+
| [History] [title]   [New] [Close]|   <-- header
|----------------------------------|
|  (if showHistory = true)         |
|  [+ New Analysis]                |
|  ┌──────────────────────────┐    |
|  │ Who are key players...   │    |
|  │ 2 hours ago              │    |
|  └──────────────────────────┘    |
|  ┌──────────────────────────┐    |
|  │ Sentiment around legal...│    |
|  │ Yesterday                │    |
|  └──────────────────────────┘    |
|  ...                             |
|----------------------------------|
|  (if showHistory = false)        |
|  [normal message view + input]   |
+----------------------------------+
```

### Technical Details

- Import `History` icon from `lucide-react` and `formatDistanceToNow` from `date-fns`
- `showHistory` state toggles between list view and chat view
- When opening chat (`setOpen(true)`), if `activeConvoId` is null, set `showHistory = true`
- Clicking a conversation card: `setActiveConvoId(id)`, `setShowHistory(false)`
- History button in header: `setShowHistory(true)`
- New Analysis button: calls `handleNewChat()` + `setShowHistory(false)`
- Hide the input area when `showHistory` is true (only show messages view + input when in a conversation)
