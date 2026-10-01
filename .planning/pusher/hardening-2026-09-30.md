# Hardening pass — 2026-09-30

Baseline: 895 tests / 46 suites, `tsc --noEmit` clean.
After: 902 tests / 47 suites, `tsc --noEmit` and `--noUnusedLocals` clean.

## Fixed

1. **v0.5.184 — Boot migration failure was silent and unrecoverable**
   (`src/providers/DatabaseProvider.tsx`). The catch only set state: nothing was
   logged, so Sentry never saw it, and a transient failure (locked DB) needed an
   app kill. Now logs `Failed to initialize database:` and offers a Try Again action
   that re-runs the idempotent migration. First test file for this provider (+4).
   Mutations: no log → 1 fail; no error reset on retry → 1; no-op retry → 2.

2. **v0.5.185 — Onboarding left an orphan family row on partial failure**
   (`app/onboarding/index.tsx`). `families` then `users` insert, no transaction, and
   a retry mints new ids — so a failed user insert left a memberless family with a
   live invite code forever. Compensating delete scoped to that family id, only
   between the two inserts; cleanup failure logged, never masks the original, latch
   still released (+3 tests). Mutations: never compensate → 2 fail; always
   compensate → 1; cleanup failure escapes → 1.

## Found, not fixed (reported only)

- **~~No root `ErrorBoundary`.~~** Fixed in v0.5.186 (`RouteErrorBoundary`). `app/_layout.tsx` exports none, so an uncaught render
  error in any screen has no in-app recovery surface. `export { ErrorBoundary } from
  'expo-router'` is the usual one-liner, but it can't be exercised meaningfully under
  the jest web harness, and the rules here require a test per change. Worth doing with
  a device build to verify.
- **Multi-step cascades/merge are not transactional** (`cascade-delete.ts`,
  `merge-foods.ts`). Already deliberately ordered dependents-first so a mid-sequence
  failure is retryable, and pinned by tests. A drizzle `transaction` would be the real
  fix, but the expo-sqlite driver runs drizzle in sync mode; whether async callbacks
  inside it are safe cannot be verified without a device. Left alone.
- **Convex functions unauthenticated** — already recorded in
  `security-2026-09-27.md`; still not deployed, still must not be.

## Checked and fine

- Every other write handler: single insert/update behind a latch released in
  `finally`/catch, with log-then-Alert (v0.5.34/v0.5.144 conventions).
- Env config: all four vars optional with safe no-op fallbacks (CLAUDE.md table).
- Unbounded reads: `exposures` is the only unbounded table; hot reads are indexed
  (v0.5.170), dashboard recent list is `LIMIT 10`. The CSV export reads a child's full
  history by design.
