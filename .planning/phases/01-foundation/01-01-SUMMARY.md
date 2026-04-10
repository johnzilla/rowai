# Plan 01-01: App Scaffold + Auth + Onboarding — Summary

## Result: COMPLETE

**Tasks:** 2/2
**Commits:**
- `6b9bb80`: feat(01-01): scaffold Next.js 16 PWA with Serwist and Supabase auth
- `0528a48`: feat(01-01): Supabase schema, signup, login, and onboarding pages

## What Was Built

Next.js 16.2.3 PWA with Serwist service worker, Supabase email/password auth with middleware-based session persistence, and minimal name-only onboarding (D-04). Full app shell ready for BLE integration.

## Key Files

### Created
- `package.json` — Next.js 16, Serwist, Supabase, Tailwind v4
- `next.config.ts` — Serwist PWA plugin
- `src/app/sw.ts` — Serwist service worker
- `src/app/manifest.json` — PWA manifest
- `src/app/layout.tsx` — Root layout with metadata
- `src/app/globals.css` — Tailwind v4 CSS-first config
- `src/proxy.ts` — Supabase middleware (Next.js 16 convention)
- `src/lib/supabase/client.ts` — Browser Supabase client
- `src/lib/supabase/server.ts` — Server Supabase client
- `src/lib/supabase/middleware.ts` — Session refresh via updateSession
- `src/app/(auth)/signup/page.tsx` — Email/password signup
- `src/app/(auth)/login/page.tsx` — Login with redirect
- `src/app/onboarding/page.tsx` — Name-only onboarding (D-04)
- `supabase/migrations/001_initial_schema.sql` — user_profile table with RLS
- `.env.local.example` — Required env vars template

## Requirements Delivered

| Requirement | Status | Evidence |
|-------------|--------|----------|
| ONBD-01 | ✓ | signup/page.tsx with createClient().auth.signUp |
| ONBD-02 | ✓ | onboarding/page.tsx collects name only (D-04) |
| ONBD-03 | ✓ | middleware.ts calls supabase.auth.getUser() on every request |

## Self-Check: PASSED

- Build passes (`npm run build` exits 0)
- All routes accessible: /, /login, /signup, /onboarding
- Migration SQL contains RLS policies
- Onboarding collects name only (no experience_level/injuries fields)

## Deviations

- Middleware file placed at `src/proxy.ts` per Next.js 16 convention (plan specified `src/middleware.ts`)
- Schema push is a manual step (structural file check passes, live `supabase db push` deferred)

## Issues

None.
