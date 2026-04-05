# SHEEN — Security Guide

## Environment Variables

### Client (Vercel) — `.env` or Vercel dashboard

| Variable | Purpose | Sensitivity |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Public — safe in browser |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Public — safe in browser (RLS enforces access) |
| `VITE_API_URL` | Backend API base URL | Public — safe in browser |

> **Rule:** Only `VITE_`-prefixed variables are bundled into the client. Never prefix secret keys with `VITE_`.

### Server (Railway) — Railway environment variables or `.env`

| Variable | Purpose | Sensitivity |
|---|---|---|
| `PORT` | Server listen port | Non-secret |
| `SUPABASE_URL` | Supabase project URL | Non-secret |
| `SUPABASE_SERVICE_KEY` | Supabase service role key — **bypasses RLS** | **SECRET** — server only, never expose to client |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude AI | **SECRET** — server only, never expose to client |
| `CLIENT_URL` | Allowed CORS origin (e.g. `https://sheen.vercel.app`) | Non-secret |

## Key Placement Rules

1. **`SUPABASE_SERVICE_KEY`** — Server only. Used in `server/src/lib/supabase.ts`. Grants full DB access bypassing Row Level Security. Never send to the browser.
2. **`ANTHROPIC_API_KEY`** — Server only. Used in `server/src/routes/ai.ts`. Consumed server-side by the Anthropic SDK. Never send to the browser.
3. **`VITE_SUPABASE_ANON_KEY`** — Client only. Used in `client/src/lib/supabase.ts`. Safe for browser because Supabase RLS policies restrict what it can access.

## Authentication

- Client uses Supabase Auth via `@supabase/supabase-js` with the anon key
- `useAuth` hook (`client/src/hooks/useAuth.ts`) wraps `getSession()` and `onAuthStateChange`
- `ProtectedRoute` component redirects unauthenticated users to `/login`
- All app routes except `/login` require an active Supabase session

## Authorization (Row Level Security)

- RLS is enabled on all Supabase tables
- `menu_items` and `ingredients`: anonymous read access (public data)
- All other tables: authenticated users only (full CRUD)
- Server uses the service key to bypass RLS for backend operations

## CORS

- `server/src/index.ts` restricts CORS to `CLIENT_URL` environment variable
- Never set CORS origin to `*` in production

## .gitignore

Both root and client `.gitignore` files exclude:
- `.env`
- `.env.local`
- `.env.*.local`

Verify these exclusions before every commit.

## Input Validation

- All POST route handlers validate required fields and types before database insertion
- String inputs are trimmed and length-limited to prevent abuse
- Numeric inputs are validated as non-negative numbers
- Date inputs are validated against `YYYY-MM-DD` or `YYYY-MM` format
- Request body size is limited to 1MB (`express.json({ limit: '1mb' })`)

## Checklist for New Features

- [ ] Never add `VITE_` prefix to secret keys
- [ ] Add input validation to every new POST/PATCH handler
- [ ] Confirm new routes use the server supabase client (service key), not anon key
- [ ] Wrap new client pages with `<ProtectedRoute>`
- [ ] Verify `.env` files are in `.gitignore` before committing
