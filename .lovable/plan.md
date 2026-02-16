

## Authentication Overhaul + Admin User Management

### Overview

Remove public signup, add role-based admin system, forgot password flow, "keep me logged in" toggle, and seed two initial admin users. Only admins can create new users.

---

### Step 1: Database Migration

Create `user_roles` table (per security requirements, roles MUST be in a separate table):

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles without RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read their own roles; admins can read all
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
```

---

### Step 2: Edge Function `admin-create-user`

New file: `supabase/functions/admin-create-user/index.ts`

- Validates caller's JWT, checks they have `admin` role via the `has_role` function
- Accepts `{ email, password, role }` in POST body
- Uses Supabase Admin API (`supabase.auth.admin.createUser`) with `email_confirm: true` to create the user (no email verification needed)
- Inserts a row into `user_roles` for the new user
- Returns the created user info

Config addition: `[functions.admin-create-user] verify_jwt = false`

---

### Step 3: Seed Admin Users

Create a one-time edge function `seed-admins` (or use the `admin-create-user` function after deployment) to create:

- `thiago@hiddenlaier.com` / `Thiago2026*` with `admin` role
- `alex@hiddenlaier.com` / `Alex2026*` with `admin` role

Both created with `email_confirm: true` so they can log in immediately. After seeding, the function can be removed.

---

### Step 4: Simplify Auth Page

**Modify `src/pages/Auth.tsx`**:
- Remove the Tabs component and signup form entirely
- Show only a login form (email + password)
- Add a "Forgot password?" link below the password field
- Add a "Keep me logged in" checkbox (defaults to checked)

**"Keep me logged in" implementation**:
- When unchecked, switch Supabase auth storage from `localStorage` to `sessionStorage` (session dies when browser closes)
- This is handled by creating the Supabase client with dynamic storage, or by calling `supabase.auth.signInWithPassword` and then clearing the session from localStorage on signout
- Simplest approach: store a flag in localStorage. On login, if "keep me logged in" is unchecked, listen for `beforeunload` and sign out. More robust: use a wrapper that swaps `persistSession` behavior.

Practical approach: 
- Add a checkbox state `rememberMe` (default true)
- After successful login, if `!rememberMe`, store a flag `session_transient=true` in sessionStorage
- In `useAuth.ts`, on mount, if `session_transient` is in sessionStorage and the page is freshly opened (no session in sessionStorage), sign out

---

### Step 5: Forgot Password Flow

**Modify `src/pages/Auth.tsx`**:
- Add a "Forgot password?" link that shows a separate form (email input + "Send reset link" button)
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`

**New file: `src/pages/ResetPassword.tsx`**:
- Public route at `/reset-password`
- On mount, checks for `type=recovery` in URL hash (Supabase redirects here with a token)
- Shows a "New password" + "Confirm password" form
- Calls `supabase.auth.updateUser({ password })` to set the new password
- On success, redirects to `/`

**Update `src/App.tsx`**: Add `<Route path="/reset-password" element={<ResetPassword />} />`

---

### Step 6: Admin Panel for User Management

**New file: `src/pages/AdminUsers.tsx`**:
- Protected route, only accessible to admins
- Shows a list of existing users (fetched via a new edge function `admin-list-users`)
- "Create User" form: email, password, role dropdown (admin/user)
- Calls the `admin-create-user` edge function
- Shows success/error toasts

**New file: `src/components/AdminRoute.tsx`**:
- Like ProtectedRoute but also checks `has_role(uid, 'admin')` via a query to `user_roles`
- Redirects non-admins to `/`

**Update `src/App.tsx`**: Add `/admin/users` route wrapped in AdminRoute

**Update `src/components/dashboard/Dashboard.tsx`**: Add a "Manage Users" button (visible only to admins) in the header, linking to `/admin/users`

---

### Files Summary

| Action | File |
|--------|------|
| Modify | `src/pages/Auth.tsx` -- remove signup, add forgot password link, add remember me checkbox |
| Create | `src/pages/ResetPassword.tsx` -- password reset form |
| Create | `src/pages/AdminUsers.tsx` -- admin user management page |
| Create | `src/components/AdminRoute.tsx` -- admin-only route guard |
| Modify | `src/hooks/useAuth.ts` -- add transient session support, expose role check |
| Modify | `src/App.tsx` -- add reset-password and admin routes |
| Modify | `src/components/dashboard/Dashboard.tsx` -- add admin link in header |
| Create | `supabase/functions/admin-create-user/index.ts` -- create users (admin only) |
| Create | `supabase/functions/admin-list-users/index.ts` -- list users (admin only) |
| Create | `supabase/functions/seed-admins/index.ts` -- one-time seed of initial admins |
| Migration | Create `user_roles` table, `app_role` enum, `has_role` function, RLS policies |

