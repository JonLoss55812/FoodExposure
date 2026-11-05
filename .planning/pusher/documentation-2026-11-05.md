# Documentation pass — 2026-11-05

Baseline: 1160 tests / 74 suites passing, `npx tsc --noEmit` clean (after `npm install`;
the worktree had no node_modules). Same result after the changes.

## Verified (accurate, no change needed)
- `npm install`, `npm run test`, `npx tsc --noEmit`, `npx jest --testPathPatterns=src/components`
  (113 tests) all work as documented. `test:watch` / `test:coverage` scripts exist.
- Node 22+ requirement (node:sqlite used by `src/test-utils/sqlite-db.ts`); ran on v22.22.2.
- `.env.example` matches the env-var tables in README and CLAUDE.md.
- CLAUDE.md version (v0.5.251), test counts, 6-table schema, cascade-delete / in-flight latch
  paths, absent dirs (`src/hooks` etc.) all match the code.
- README's "Join only finds families on this device" is true (`app/onboarding/join.tsx`
  queries local SQLite).

## Fixed
1. **Stray files** `surface` and `textSecondary` (grep fragments) were committed at the repo
   root in 1ebb9cd. Removed.
2. **README**: v0.5.213 / 1005 tests / 63 suites → pointer to CLAUDE.md (which every versioned
   commit updates), so it can't drift again. Audit "59 advisories from 5 roots" → 6 roots
   (39 advisories today). Changelog location `CLAUDE.md` → `CHANGELOG.md` (moved at v0.5.231).
3. **CLAUDE.md**: audit count 48 → 39 (same six roots: decode-uri-component, deepmerge,
   esbuild, glob, minimatch, @expo/cli's zod 3). Added `src/test-utils/mock-theme.ts` and
   `src/__mocks__/` to the tree, and a Testing bullet on the `setMockTheme` seam and why it
   must be imported from test-utils, not the mock.

## Not changed (needs a human)
- CLAUDE.md "Next Priority" (wire Convex) contradicts NEXT_STEPS §D (don't). Already logged as
  NEXT_STEPS A1, a product decision. Left alone.
- `docs/superpowers/specs/2026-03-26-tongue-tutor-design.md` is an original design spec and
  may describe unbuilt features. It is not referenced from README/CLAUDE.md, so I did not
  audit it.
