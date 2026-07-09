# Clerk proxy.ts migration design

**Date:** 2026-07-09  
**Status:** Implemented

## Summary

Migrated from deprecated middleware-based route protection (`createRouteMatcher` + `auth.protect()` in `proxy.ts`) to Clerk's recommended resource-based auth model. The dashboard layout is the single auth gate for all application functionality.

## Background

Clerk deprecated `createRouteMatcher()` in `@clerk/nextjs@7.5.14`. Middleware path matching can diverge from Next.js App Router routing, leaving protected resources reachable. The new guidance is to call `auth.protect()` on each protected server resource (Page, Layout, Route Handler, Server Action) and keep `proxy.ts` as a thin `clerkMiddleware()` shell for session propagation.

## Architecture

### Before

- `proxy.ts`: protected-first middleware — all routes require sign-in except `/sign-in` and `/sign-up`
- `(dashboard)/layout.tsx`: duplicate `auth.protect()` for server-side preloads

### After

- `proxy.ts`: `clerkMiddleware()` only — session propagation, no auth decisions
- `(dashboard)/layout.tsx`: sole auth gate via `await auth.protect()` for all dashboard pages
- `(auth)/` routes (`/sign-in`, `/sign-up`): public by default
- Root `/`: redirects to `/dashboard`, then dashboard layout enforces auth

## Auth flow

1. **GET /dashboard (signed out)** → proxy forwards → dashboard layout `auth.protect()` → redirect to `/sign-in`
2. **GET / (signed out)** → redirect to `/dashboard` → dashboard layout protects → redirect to `/sign-in`
3. **GET /sign-in** → public, no `auth.protect()`
4. **GET /dashboard (signed in)** → dashboard layout allows → page renders, Convex preloads run

## Edge cases

| Route                              | Behavior                               |
| ---------------------------------- | -------------------------------------- |
| `/dashboard/*`                     | Protected by dashboard layout          |
| `/sign-in`, `/sign-up`             | Public                                 |
| `/`                                | Redirect → `/dashboard` → protected    |
| `not-found.tsx`, `error.tsx`       | Public (acceptable for internal tool)  |
| Future API routes / Server Actions | Must add `auth.protect()` per resource |

## Files changed

| File                                  | Change                                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| `apps/web/proxy.ts`                   | Removed `createRouteMatcher` and middleware `auth.protect()` |
| `README.md`                           | Updated route protection and verification docs               |
| `apps/web/app/(dashboard)/layout.tsx` | No change — already correct                                  |

## Verification

- [ ] Sign out → `/dashboard` → redirected to `/sign-in`
- [ ] Sign out → `/` → redirected to `/dashboard` → `/sign-in`
- [ ] Sign in → `/dashboard` loads, Convex auth succeeds
- [ ] `/sign-in` and `/sign-up` accessible while signed out
- [ ] No `createRouteMatcher` deprecation warning in dev console
- [ ] `pnpm build` succeeds

## References

- [clerkMiddleware()](https://clerk.com/docs/reference/nextjs/clerk-middleware)
- [Migrate from createRouteMatcher](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/migrate-from-create-route-matcher)
