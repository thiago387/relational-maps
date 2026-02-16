

## AI Analysis Chatbot with Authentication

### Overview

Add user authentication (email/password login and signup) to protect the dashboard, then build a floating AI chatbot panel with per-user conversation memory. Only logged-in users can access the dashboard and the chatbot. Each user's chat history is private to them.

---

### Step 1: Database Migration

Create three new tables and configure RLS:

**`profiles`** -- auto-created on signup via trigger
- `id` uuid PK (references auth.users ON DELETE CASCADE)
- `email` text
- `display_name` text nullable
- `created_at` timestamptz

**`chat_conversations`** -- per-user conversation sessions
- `id` uuid PK
- `user_id` uuid NOT NULL (references auth.users ON DELETE CASCADE)
- `title` text default 'New Analysis'
- `created_at` / `updated_at` timestamptz

**`chat_messages`** -- individual messages within a conversation
- `id` uuid PK
- `conversation_id` uuid FK -> chat_conversations ON DELETE CASCADE
- `role` text NOT NULL ('user' or 'assistant')
- `content` text NOT NULL
- `created_at` timestamptz

**RLS policies** (all tables):
- profiles: users can SELECT/UPDATE only their own row (`auth.uid() = id`)
- chat_conversations: users can SELECT/INSERT/UPDATE/DELETE only their own rows (`auth.uid() = user_id`)
- chat_messages: users can SELECT/INSERT rows only where the parent conversation belongs to them (via a subquery or security definer function)

**Trigger**: auto-create a profile row when a new user signs up via `auth.users` INSERT trigger.

---

### Step 2: Authentication UI

**New file: `src/pages/Auth.tsx`**
- A login/signup page with two tabs: "Sign In" and "Sign Up"
- Email + password fields using existing shadcn Input, Button, Tabs components
- Calls `supabase.auth.signInWithPassword()` and `supabase.auth.signUp()`
- On success, redirects to `/`
- Clean, centered card layout matching the dark/light theme

**New file: `src/hooks/useAuth.ts`**
- Custom hook wrapping `supabase.auth.onAuthStateChange` and `supabase.auth.getSession`
- Returns `{ user, session, loading, signOut }`
- Sets up the listener BEFORE calling getSession (per best practices)

**New file: `src/components/ProtectedRoute.tsx`**
- Wraps children; if no session and not loading, redirects to `/auth`
- Shows a spinner while loading

**Updates to `src/App.tsx`**:
- Add `/auth` route pointing to Auth page
- Wrap `/` and `/messages` routes in ProtectedRoute

**Update to `src/components/dashboard/Dashboard.tsx`**:
- Add a "Sign Out" button in the header (e.g., a LogOut icon button next to the theme toggle)
- Uses `supabase.auth.signOut()`

---

### Step 3: Edge Function `chat-analysis`

**New file: `supabase/functions/chat-analysis/index.ts`**

Config in `supabase/config.toml`:
```
[functions.chat-analysis]
verify_jwt = false
```

Flow:
1. Validate the JWT from Authorization header using `getClaims()`
2. Extract `user_id` from claims
3. Receive `{ message, conversation_id? }` via POST
4. If no `conversation_id`, create a new row in `chat_conversations` (with `user_id`)
5. Save the user message to `chat_messages`
6. Load conversation history (last 20 messages) from `chat_messages`
7. Query the DB for a **data context summary**:
   - Total counts (emails, persons, edges)
   - Top 10 persons by email volume
   - Community summary
   - Top 10 topics
8. Build system prompt with the data context, instructing the model to be a network analysis expert
9. Call Lovable AI gateway (`google/gemini-3-flash-preview`) with streaming
10. Stream SSE response back to client
11. After stream completes, save the full assistant message to `chat_messages`

---

### Step 4: ChatPanel Component

**New file: `src/components/dashboard/ChatPanel.tsx`**

Two visual states:

**Collapsed** (default): A circular button with a MessageSquare icon, fixed to bottom-left (above sidebar z-index), z-60.

**Expanded**: A 400px wide, ~500px tall panel anchored bottom-left with:
- **Header**: conversation title, a dropdown to switch between past conversations, "New Chat" button, minimize button
- **Messages area**: ScrollArea with messages. User messages right-aligned (blue bubble), assistant messages left-aligned (gray bubble), rendered with `whitespace-pre-wrap` for basic formatting
- **Input area**: textarea + send button, disabled while streaming

Features:
- Fetches conversations list from `chat_conversations` WHERE `user_id` matches (via Supabase client which auto-attaches the JWT)
- Switching conversations loads that conversation's messages from `chat_messages`
- Streams responses using SSE line-by-line parsing
- Auto-scrolls to bottom on new tokens
- Escape key or X button to minimize

**Update to `src/components/dashboard/Dashboard.tsx`**:
- Import and render `<ChatPanel />` inside the main content area, positioned fixed bottom-left z-60

---

### Technical Details

| Item | Detail |
|------|--------|
| AI Model | `google/gemini-3-flash-preview` via Lovable AI gateway |
| Streaming | SSE with `text/event-stream`, parsed line-by-line on client |
| Auth | Email/password via Supabase Auth, JWT validated in edge function |
| Conversation isolation | RLS on `chat_conversations` and `chat_messages` scoped to `auth.uid()` |
| No new dependencies | Uses existing shadcn/ui, lucide-react, Supabase client |

### Files Created/Modified

| Action | File |
|--------|------|
| Create | `src/pages/Auth.tsx` |
| Create | `src/hooks/useAuth.ts` |
| Create | `src/components/ProtectedRoute.tsx` |
| Create | `src/components/dashboard/ChatPanel.tsx` |
| Create | `supabase/functions/chat-analysis/index.ts` |
| Modify | `src/App.tsx` -- add auth route + protected routes |
| Modify | `src/components/dashboard/Dashboard.tsx` -- add sign-out button + render ChatPanel |
| Modify | `supabase/config.toml` -- add chat-analysis function config |
| Migration | Create profiles, chat_conversations, chat_messages tables with RLS + trigger |

