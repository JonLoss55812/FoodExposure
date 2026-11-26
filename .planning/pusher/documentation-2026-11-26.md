# Documentation pass — 2026-11-26

Baseline: 1275 tests / 77 suites passing, `npx tsc --noEmit` clean, after `npm install`.
The worktree had no `node_modules`. Results were the same after the change, which was docs only.

## Verified (accurate, no change needed)
- `npm install` (Node v22.22.2), `npm run test`, `npx tsc --noEmit` and
  `npx jest --testPathPatterns=src/components` (120 tests) all work as documented.
  The `test:watch` and `test:coverage` scripts exist.
- `.env.example` matches the env-var tables in README and CLAUDE.md.
- CLAUDE.md matches the code: version v0.5.284, test and suite counts, the 6 tables in
  `src/db/schema.ts`, the paths for test-utils, cascade-delete and in-flight latch, the FK
  pragma in DatabaseProvider, the app route tree, no `<Link>` usage, and no hex literals
  outside comments.
- CLAUDE.md's audit summary is still accurate: `npm audit` reports 36 advisories (31 moderate,
  5 high) from 5 roots: decode-uri-component, esbuild, glob, minimatch and zod (@expo/cli).
- `npm run web` (via `npx expo start --web`): the HTML at `/` is served with **no** COOP/COEP
  headers, and the bundle response carries both. This matches CLAUDE.md's Known Limitations.

## Fixed
1. **README audit paragraph** was stale ("6 root packages, 39 advisories, 2026-11-05") and
   wrong ("all six are in build/test tooling"). `decode-uri-component` is in the app bundle
   via expo-router → query-string. It now says 5 roots / 36 and names them, which matches CLAUDE.md.
2. **README web caveat** said the database "may not open". A browser check on 2026-11-14
   (recorded in CLAUDE.md) showed that it does not open, and today's curl shows the same
   headers. The caveat now states it definitively and gives the error.

## Not changed (needs a human)
- CLAUDE.md "Next Priority" (wire Convex) still contradicts NEXT_STEPS §D. That is NEXT_STEPS
  A1, a product decision.
- `docs/superpowers/specs/2026-03-26-tongue-tutor-design.md` is an original design spec and
  is not referenced by README or CLAUDE.md. I did not audit it.
