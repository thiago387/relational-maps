
## Move Chatbot to Bottom-Right

A quick positioning fix: change `left-6` to `right-6` in the two places where the chat panel is positioned.

### Changes

**File: `src/components/dashboard/ChatPanel.tsx`**

1. **Line 180** (collapsed bubble button): Change `fixed bottom-6 left-6 z-[60]` to `fixed bottom-6 right-6 z-[60]`
2. **Line 188** (open chat container): Change `fixed bottom-6 left-6 z-[60]` to `fixed bottom-6 right-6 z-[60]`

No other files or logic changes needed.
