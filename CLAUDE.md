# StudyFlow — CLAUDE.md

A comprehensive reference for AI-assisted development on this project.

> **Self-maintenance rule:** After every important change (new feature, structural change, new extension, new API route, file additions/removals, new dependency, or convention change), update this CLAUDE.md file to reflect the current state of the project. Do this automatically without being asked. **Always inform the user in your summary about what was added or changed in CLAUDE.md.**

> **Economy mode:** Do NOT read or explore the entire project on every prompt. This CLAUDE.md file contains the full project structure, conventions, and context. Use it as the primary reference. Only read specific files that are directly relevant to the current task. Avoid redundant file reads — if the information is already documented here, use it directly.

---

## Project Overview

**StudyFlow** is a student productivity web app built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Supabase** (auth + database).

Core features:
- Pomodoro focus timer
- Task/kanban board
- File storage (Supabase Storage)
- User profile management
- Dark/light theme toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Font | Geist Sans / Geist Mono (via `next/font`) |
| Backend / Auth | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) |
| CAPTCHA | Google reCAPTCHA v2 (`react-google-recaptcha`) |
| Package manager | npm |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root layout, wraps ThemeProvider
│   ├── page.tsx                    # Landing page
│   ├── globals.css                 # Global CSS & CSS custom properties (theme vars)
│   ├── components/
│   │   └── ThemeToggle.tsx         # Dark/light toggle button
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login form
│   │   └── register/page.tsx       # Register form (with password rules + CAPTCHA)
│   └── (dashboard)/
│       ├── layout.tsx              # Dashboard layout (auth guard)
│       └── dashboard/
│           ├── page.tsx            # Dashboard home
│           ├── LiveClock.tsx
│           ├── ProfileDropdown.tsx
│           ├── Sidebar.tsx
│           ├── DashboardClientWrapper.tsx # Wraps children with TimerProvider + MiniTimer
│           ├── MiniTimer.tsx          # Floating mini-timer widget (bottom-left)
│           ├── focus/
│           │   ├── page.tsx
│           │   └── PomodoroTimer.tsx   # Consumes TimerContext (no local timer state)
│           ├── tasks/
│           │   ├── page.tsx
│           │   ├── TaskBoard.tsx    # Kanban board with duplicate name prevention
│           │   └── actions.ts      # Server actions for tasks (Supabase)
│           ├── notes/
│           │   ├── page.tsx
│           │   ├── NoteList.tsx     # Note listing with auto-naming
│           │   ├── actions.ts      # Server actions for notes (CRUD, sharing, dup check)
│           │   └── [noteId]/
│           │       ├── page.tsx
│           │       ├── NoteEditor.tsx            # TipTap editor with all features
│           │       ├── Toolbar.tsx               # Editor toolbar (undo/redo, formatting, drawing)
│           │       ├── ResizableImageExtension.tsx # Custom TipTap node for resizable/draggable images
│           │       ├── CodeBlockExtension.tsx    # Custom code block with inline delete button
│           │       ├── DrawingCanvas.tsx         # Freehand drawing canvas with brush tools
│           │       ├── ImageUpload.tsx           # Image upload modal
│           │       └── ShareDialog.tsx           # Note sharing dialog
│           ├── storage/
│           │   ├── page.tsx
│           │   ├── StorageClient.tsx
│           │   └── actions.ts      # Server actions for storage
│           └── profile/
│               ├── page.tsx
│               ├── ProfileForm.tsx
│               └── actions.ts      # Server actions for profile
└── lib/
    ├── ThemeContext.tsx             # React context for dark/light theme
    ├── TimerContext.tsx             # Global timer state (persists across page navigation)
    └── supabase/
        ├── client.ts               # Browser Supabase client (createBrowserClient)
        └── server.ts               # Server Supabase client (createServerClient)
```

---

## Routing Conventions

- `(auth)` route group — unauthenticated pages (`/login`, `/register`)
- `(dashboard)` route group — authenticated pages (`/dashboard`, `/dashboard/focus`, etc.)
- Route groups use parentheses and **do not affect the URL path**
- Dashboard layout (`(dashboard)/layout.tsx`) handles the auth redirect guard

---

## Environment Variables

All secrets live in `.env.local` (never commit this file).

```env
NEXT_PUBLIC_SUPABASE_URL=          # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Your Supabase anon/public key
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=    # Google reCAPTCHA v2 site key
```

### Getting a reCAPTCHA key
1. Go to https://www.google.com/recaptcha/admin/create
2. Choose **reCAPTCHA v2 → "I'm not a robot" Checkbox**
3. Add `localhost` (and your production domain) under **Domains**
4. Copy the **Site Key** into `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`
5. The **Secret Key** is for server-side token verification — store it as `RECAPTCHA_SECRET_KEY` (not `NEXT_PUBLIC_`) if you add server-side validation later

---

## Supabase Setup

### Client usage
- **Client components** → `import { createClient } from '@/lib/supabase/client'`
- **Server components / Server Actions** → `import { createClient } from '@/lib/supabase/server'`

### Auth flow
- Sign-up via `supabase.auth.signUp({ email, password })`
- Sign-in via `supabase.auth.signInWithPassword({ email, password })`
- If email confirmation is **OFF** in Supabase dashboard → `data.session` is set immediately after sign-up → redirect to `/dashboard`
- If email confirmation is **ON** → show "check your email" screen

### Server Actions
Mutations for tasks, storage, and profile use Next.js Server Actions (`'use server'`) located at `actions.ts` files next to their page. They create a server Supabase client on each call.

---

## Theming

- Theme state is managed by `ThemeContext` (`src/lib/ThemeContext.tsx`)
- The root `<html>` element toggles a `dark` class
- All colors are CSS custom properties defined in `globals.css` under `:root` (light) and `.dark` (dark)
- **Never** hardcode colors in components — always use CSS variables like `var(--card-bg)`, `var(--foreground)`, etc.

### Key CSS variables
| Variable | Usage |
|---|---|
| `--background` / `--background-deep` | Page backgrounds |
| `--card-bg` / `--card-border` | Card surfaces |
| `--foreground` / `--heading-text` | Primary text |
| `--muted-text` / `--subtle-text` | Secondary text |
| `--input-bg` / `--input-border` / `--input-text` | Form inputs |
| `--accent` | Brand violet accent |
| `--label-text` | Form labels |

### Semantic token variables (theme-adaptive)
These variables resolve differently in light vs dark mode and should be used instead of hardcoding `bg-white/5`, `text-gray-400`, `bg-black/20`, `border-white/10`, etc.

| Variable | Dark value | Light value | Usage |
|---|---|---|---|
| `--overlay-soft` | `rgba(255,255,255,0.05)` | `rgba(0,0,0,0.04)` | Subtle backgrounds (pills, counters) |
| `--overlay-medium` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.07)` | Hover states, button backgrounds |
| `--overlay-strong` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.10)` | Active states, sliders |
| `--ring-track` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.06)` | SVG ring backgrounds |
| `--pill-bg` / `--pill-border` | `white/5`, `white/8` | `black/5`, `black/8` | Small badges, pills |
| `--glass-bg` | dark card with opacity | white with opacity | Glassmorphism floating elements |
| `--text-primary` | `#ffffff` | `#111827` | Strongest text |
| `--text-secondary` | `#d1d5db` | `#4b5563` | Body text, task titles |
| `--text-tertiary` | `#9ca3af` | `#6b7280` | Labels, hints |
| `--text-quaternary` | `#6b7280` | `#9ca3af` | Weakest text, counts |
| `--shadow-color` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.08)` | Box shadows |
| `--dashed-border` | `#374151` | `#d1d5db` | Dashed borders on empty states |
| `--active-nav-bg/text/border` | violet shades | violet shades | Active sidebar link, active badges |

**Rule:** Never use `bg-white/X`, `bg-black/X`, `text-gray-X`, or `border-white/X` for theme-sensitive elements. Use `var(--overlay-*)`, `var(--text-*)`, or `var(--pill-*)` instead. Tailwind arbitrary value syntax like `hover:bg-[var(--overlay-medium)]` works for hover states.

---

## CAPTCHA Integration

Both `/login` and `/register` use **Google reCAPTCHA v2 (checkbox)**.

### How it works
1. `ReCAPTCHA` widget is rendered before the submit button
2. `captchaToken` state holds the token returned by reCAPTCHA on success
3. Submit button is **disabled** until the checkbox is checked (`disabled={loading || !captchaToken}`)
4. On form submit, if `captchaToken` is null, an error is shown before any Supabase call
5. On auth failure, the reCAPTCHA widget is **reset** so the user must verify again

### Current state (client-side only)
The CAPTCHA is currently validated only client-side (token presence check). For production hardening, add **server-side token verification**:
- Create a Server Action or API route
- POST the token to `https://www.google.com/recaptcha/api/siteverify` with your `RECAPTCHA_SECRET_KEY`
- Only proceed with Supabase auth if Google confirms the token is valid

---

## Styling Conventions

- **Tailwind v4** is used via PostCSS (`@tailwindcss/postcss`)
- Utility classes handle layout/spacing/sizing
- Colors and theme-aware styles go through CSS variables in `style={{}}` props
- Cards follow the pattern:
  ```tsx
  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }} className="rounded-2xl p-8">
  ```
- Focus rings use `focus:ring-violet-500`
- Gradient buttons: `bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500`

---

## Component Patterns

### Forms
- All auth forms are `'use client'` components
- Controlled inputs with `useState`
- Error displayed with `<p className="text-red-400 text-sm">{error}</p>`
- Loading state disables submit button and shows descriptive text

### Password strength (Register only)
- `PASSWORD_RULES` array — each rule has a `test` function
- `useMemo` computes rule results on every password change
- Strength bar + checklist shown when `password.length > 0`

### Server Actions pattern
```ts
'use server'
import { createClient } from '@/lib/supabase/server'

export async function someAction(formData: FormData) {
  const supabase = await createClient()
  // ...
}
```

---

## Common Tasks

### Add a new dashboard page
1. Create `src/app/(dashboard)/dashboard/<page-name>/page.tsx`
2. Add a `'use client'` or `'use server'` directive as needed
3. Add a sidebar link in `Sidebar.tsx`

### Add a new environment variable
1. Add to `.env.local`
2. If it's client-accessible, prefix with `NEXT_PUBLIC_`
3. Document it in this file under **Environment Variables**

### Run the dev server
```bash
npm run dev
```

### Build for production
```bash
npm run build
npm start
```

### Lint
```bash
npm run lint
```

---

## Notes Feature

The notes section is a modern collaborative notetaking feature built on **TipTap** (rich text editor framework).

### Key behaviors
- **Auto-naming**: New notes get unique names (`Untitled`, `Untitled1`, `Untitled2`...)
- **Duplicate name prevention**: Users are warned and saves are blocked when a note title matches an existing one (case-insensitive)
- **Undo/Redo**: Toolbar buttons and keyboard shortcuts (Ctrl+Z / Ctrl+Y)
- **Free-positioned images/drawings**: Images and drawings are absolutely positioned on the editor canvas — drag to move anywhere freely, single resize handle (bottom-right) to resize. Position (posX/posY) and width are stored as TipTap node attributes and persisted in the note JSON. Mouse handling uses a 5px drag threshold: clicks select the node (ProseMirror NodeSelection for Delete/Backspace), while actual movement starts dragging.
- **Image selection & deletion**: Click an image to select it (violet outline), then press Delete/Backspace to remove it. **Ctrl+Click** toggles multi-selection (blue outline with glow) across multiple images, and Delete removes all multi-selected images at once. Multi-selection is cleared when clicking on non-image content. The multi-select state is shared across NodeView instances via a module-level reactive store (`toggleImageMultiSelect`, `clearImageMultiSelect`, `getMultiSelectedSrcs` exported from `ResizableImageExtension.tsx`).
- **Manual save only**: Notes are saved exclusively via **Ctrl+S** (manual save) and **on close** (beforeunload / SPA unmount via `sendBeacon`). There is no auto-save, no debounced save, and no visibility-change save. Image/drawing inserts update `latestContentRef` but do not trigger a save — the user must Ctrl+S or close the note.
- **Image URL handling**: Images are stored in Supabase Storage (`note-images` bucket) under the owner's user ID path. **Owner** sees direct public URLs. **Shared users** get proxy URLs (`/api/note-image?path=...&noteId=...`) rewritten by `getNote()` via `resolveImageUrls()` — the proxy route authenticates the user, verifies note access, and serves the image via signed URL. Before saving (in `updateNote` and `/api/save-note`), any proxy or signed URLs are normalized back to public URLs via `normalizeImageUrls()` so the DB always stores clean public URLs. The `ResizableImageView` uses `attrs.src` as-is (no client-side URL rewriting) and includes loading shimmer + error/retry states.
- **Image storage cleanup (orphan-based, on note close)**: Images/drawings are **never** deleted from Supabase Storage during editing — this ensures Undo always works. Cleanup happens only when the note is actually closed (beforeunload or SPA unmount), NOT on tab switch. The `/api/save-note` endpoint accepts an optional `cleanup: true` flag; when set, it first saves the note content, then fetches ALL of the user's notes (both owned AND shared-with) from the DB, collects every referenced image URL, lists the user's files in the `note-images` storage bucket, and deletes any files not referenced by any note (orphans). Shared notes are included in the scan so that images uploaded by a shared user to a shared note are not incorrectly treated as orphans. Files starting with `.` (e.g. `.emptyFolderPlaceholder`) are always preserved. When a note is deleted entirely, `deleteNote()` also cleans up all associated images from storage. Only images owned by the current user (path starts with `userId/`) are deleted to prevent accidental cleanup of shared images.
- **Drawing canvas**: Full freehand drawing tool with pen, eraser, color picker, brush size, undo/redo, clear — drawings are uploaded to Supabase Storage
- **Notion-style tables**: Clean minimal table styling; no floating table controls or toolbar table manipulation buttons — only an insert table button in the toolbar
- **Toolbar insert safety**: Inserting a table, horizontal rule, or code block moves the cursor to the end of the document first (`editor.commands.focus('end')`) to avoid replacing a currently selected image/drawing atom node.
- **Code block delete**: Delete button (trash icon) appears on hover at the top-right corner of each code block (via `CodeBlockExtension.tsx` custom NodeView)
- **Horizontal rule deletion**: Click to select, then press Backspace/Delete to remove
- **Note sharing**: Owner can share notes with other users by email (view or edit permission). Owner can change permissions (view/edit toggle) and revoke access from the ShareDialog. Recipients can leave/remove shared notes from their list via a leave button on the shared note card. The `getNoteShares` action fetches shares and profiles separately (no FK join) to avoid silent failures if the FK name doesn't match.
- **Permission update via RPC**: The `updateSharePermission` action uses the `update_share_permission` RPC function (`SECURITY DEFINER`) to bypass RLS on `note_shares`. This is necessary because the note owner isn't in the `shared_with` column, so RLS blocks direct UPDATE operations. Ownership is verified both in the server action (via the `notes` table) and inside the RPC function. The ShareDialog passes `noteId` to the action and displays errors from permission changes.
- **Concurrent user detection**: Uses Supabase Realtime **Presence** to detect when multiple users have the same note open. A warning banner shows the email(s) of other users currently viewing the note. Presence is tracked per-note via channel `note-presence-{noteId}`.
- **Permission polling**: Shared users' permissions are polled every 5s. If access is revoked, the shared user is redirected to the notes list. If permission changes (view↔edit), the editor updates immediately.

### Tasks feature
- **Duplicate task name prevention**: Users cannot create tasks with the same name as an existing task (case-insensitive check)

---

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/save-note` | POST | Beacon-based note save; accepts optional `cleanup: true` flag to also delete orphaned images from storage after saving |
| `/api/note-image` | GET | Image proxy for shared notes — verifies note access, fetches from Supabase Storage, serves with caching headers |

---

## Supabase Database Functions (RPC)

| Function | Purpose |
|---|---|
| `get_user_id_by_email(lookup_email TEXT)` | Returns user UUID from `auth.users` by email. Used by note sharing to find target users. `SECURITY DEFINER` so it works with the anon key. |
| `get_user_email_by_id(lookup_id UUID)` | Returns user email from `auth.users` by UUID. Used by `getNoteShares` to backfill missing profile emails. `SECURITY DEFINER`. |
| `update_share_permission(p_share_id UUID, p_note_id UUID, p_permission TEXT, p_owner_id UUID)` | Updates a share's permission, bypassing RLS on `note_shares`. Verifies note ownership and share existence internally. `SECURITY DEFINER`. |
| `remove_share(p_share_id UUID, p_note_id UUID, p_owner_id UUID)` | Deletes a share entry, bypassing RLS on `note_shares`. Verifies note ownership before deleting. `SECURITY DEFINER`. |

---

## Profile Feature

- **Change Password**: Collapsible section in `ProfileForm.tsx`. Verifies the current password by re-authenticating via `signInWithPassword`, then calls `supabase.auth.updateUser({ password })`. The `changePassword` server action is in `profile/actions.ts`. Enforces the same 5-rule password policy as the register page (length, uppercase, lowercase, number, special char). All three password fields have eye toggle visibility buttons.

---

## Focus Timer (Persistent)

- **Global timer state**: Timer state (mode, timeLeft, running, pomodoroCount, settings) lives in `TimerContext` (`src/lib/TimerContext.tsx`), provided by `DashboardClientWrapper` at the dashboard layout level. This means the timer keeps running when navigating between dashboard pages.
- **MiniTimer widget**: When the timer is active (running or paused mid-session) and the user is NOT on `/dashboard/focus`, a floating mini-timer appears at the bottom-left corner. It shows the countdown, mode icon, play/pause button, and a circular progress ring. Clicking it navigates to the focus page.
- **PomodoroTimer**: The full focus page component (`PomodoroTimer.tsx`) consumes `useTimer()` from context — it has no local timer state. Settings modal state is local since it's UI-only.

---

## Known Constraints & Decisions

- **No ORM** — all database access goes through the Supabase JS client directly
- **No test suite** currently set up
- **reCAPTCHA is client-side only** — server-side verification should be added before going to production
- The `proxy.ts` file in `src/` purpose should be confirmed before modifying it
- Tailwind v4 uses a different config approach than v3 — no `tailwind.config.js` is needed; configuration lives in CSS
- **RLS on `note_shares`**: The note owner is NOT in the `shared_with` column, so RLS policies that check `shared_with = auth.uid()` block the owner from SELECT/UPDATE/DELETE on shares. Use `SECURITY DEFINER` RPC functions (e.g. `update_share_permission`) or adjust RLS policies to also check note ownership when the owner needs to modify shares.
