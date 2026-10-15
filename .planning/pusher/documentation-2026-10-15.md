# Documentation pass — 2026-10-15

Baseline: `npm install` (fresh worktree) → `npm run test` **1005 passed / 63 suites**,
`npx tsc --noEmit` clean. No code changed, so the baseline is the final state too.

## Verified as written (README / CLAUDE.md)
- `npm install` with no flags exits 0.
- `npm run test` runs 1005 tests across 63 suites. `npx jest --testPathPatterns=src/components` works (88 tests).
- `npx tsc --noEmit` is clean.
- `npm run web` starts and serves HTTP 200 on `/`.
- The env var table matches `src/lib/sentry.ts`, `src/lib/posthog.ts` and `src/providers/ConvexProvider.tsx`.
- Node 22+ requirement: `node:sqlite` is used (local Node is v22.22.2).

## Fixed
1. **README counts were stale**: v0.5.191 / 936 tests / 51 suites, and "824 tests, 42
   suites" in the Test block. Both now read v0.5.213 / 1005 / 63.
2. **README advisory count was wrong**: it said "~19 moderate" and pointed at v0.5.165.
   `npm audit` actually reports 59 (13 moderate, 46 high), matching CLAUDE.md's v0.5.204 entry.
3. **README mentioned `SENDY_*` entries in `.env.example`** that no longer exist. Deleted.
4. **`.env.example` was a trap.** README said to copy it to `.env`, but every variable held
   a placeholder value, and a placeholder is not "unset": `your-posthog-key` would initialise
   PostHog, and `https://your-sentry-dsn` would initialise Sentry with a bogus DSN. Every
   line is now commented out, so a straight copy changes nothing. README and CLAUDE.md
   now say to uncomment only the variables you have real values for.
5. **The web COOP/COEP claim was false.** CLAUDE.md and NEXT_STEPS (v0.5.205/206)
   said the dev server sends the headers. Checked with `curl` against `npm run web`:
   - `GET /` (the HTML document): **no** COOP/COEP headers
   - `GET /status`: none
   - `GET /index.ts.bundle?...`: `Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin`

   A browser decides cross-origin isolation from the *document's* headers, so the page is
   very likely not isolated and expo-sqlite's SharedArrayBuffer worker would fail. I did
   not load it in a browser. Docs corrected in all three files. **Not fixed in code**:
   this is a documentation task, and the fix needs the HTML response, which Expo CLI
   serves outside Metro's `enhanceMiddleware`. Next step is in NEXT_STEPS.
6. **CLAUDE.md cited two reports that do not exist**:
   `.planning/pusher/dependencies-2026-10-10.md` and `performance-2026-10-13.md`.
   `.planning/` is gitignored, so they were never committed. Citations corrected, and an
   Important Note added: commit pusher reports with `git add -f`. This report is committed that way.
7. **CLAUDE.md directory tree had stale entries**: it was missing `migrate.ts` and
   `test-utils/sqlite-db.ts`, and the DatabaseProvider description was out of date.
8. **`src/db/migrations/0000_init.sql` was undocumented.** It is drizzle-kit output from
   the initial commit: never executed, and missing the later CHECKs and indexes. Now noted
   in CLAUDE.md so nobody edits it expecting an effect. I left the file in place, because
   `drizzle.config.ts` still points `out` there.

## Not changed
- No version bump. Docs-only commits have not bumped `APP_VERSION` historically.
- NEXT_STEPS.md body: it is a long, dated session log with its own "read this first"
  caveat. I only prepended the web correction.
