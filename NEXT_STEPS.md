# NEXT_STEPS.md

Reviewed at: v0.5.141 — 565 tests passing across 28 suites, TypeScript clean.

## Status of the original plan (v0.1.0 review)

All five priorities from the original review have shipped:

- **P1 Null-child safety** — v0.1.1 (`ensureSelection`, onboarding redirect, per-screen guards).
- **P2 Exposure hierarchy UX** — v0.2.0 (6-stage picker surfaced, `tolerate` default, one-tap stage bump).
- **P3 Safe-food surface** — v0.3.0 (pinned Safe Foods row, star badge, detail-page toggle).
- **P4 Threshold progress** — v0.4.0 (`thresholds.ts`, feeding-profile selector, per-food X/15 bars).
- **P5 CSV export** — v0.5.0 (RFC 4180 + BOM + formula-injection guard + share sheet).
- **P6 Coverage uplift** — ongoing; v0.5.1–v0.5.137 hardened validation schemas, stores,
  helpers, a11y, and DB CHECK constraints extensively. See CLAUDE.md changelog.

## Recently shipped (last two sessions, 2026-08-25/26)

- v0.5.136 — duplicate food-name guard on Add Food (`findDuplicateFood` helper,
  family-scoped, case-insensitive + trimmed, pre-insert Alert).
- v0.5.137 — optional chip dimensions (rating/meal/temperature/texture/setting/
  preparation) deselect on re-tap; previously unclearable once tapped.
- v0.5.138 — Delete Food on the food detail page (confirm Alert, cascades
  food_chains + exposures dependents-first, replaces to Foods tab).
- v0.5.139 — Delete Child rows in Settings → Family (confirm Alert, cascades
  food_chains + exposures, `ensureSelection` repairs selection; list loads via
  `useFocusEffect` — the first focus-based reload in the codebase).
- v0.5.140 — dashboard / Foods / Progress now reload on focus (closes the
  stale-tab gap below). Spinner is gated to the first load via a `hasLoadedRef`
  so tab switches refresh silently instead of flashing the ActivityIndicator.
- v0.5.141 — the two destructive cascades extracted to
  `src/lib/cascade-delete.ts` and covered by 8 tests (ordering, per-step
  predicates, mid-sequence failure, blank/non-string id guard).

## Known gaps worth doing next (discovered, deliberately not done)

1. **No screen render harness.** The single biggest remaining test gap: every
   `app/` screen (forms, handlers, conditional empty states) ships without tests
   because there is no jest harness for expo-router + drizzle + MMKV screens.
   Dozens of changelog entries cite the "ship-without-test pattern" for this
   reason. Setting up one working screen test (e.g. `app/onboarding/join.tsx`
   with mocked db/stores) would unlock testing the largest untested surface.
   Budget a full session; the mocking is the hard part, not the assertions.
   The delete flows' *cascade logic* is now covered by unit tests (v0.5.141),
   so the remaining untested part of them is only the screen glue: the confirm
   Alert wiring, the in-flight double-tap guard, and the post-delete navigation
   / `ensureSelection` repair. Still prime first candidates for a harness.
2. **Legacy duplicate foods are not deduped.** v0.5.136 guards new adds only.
   With v0.5.138 a parent can now delete a twin manually, but that discards the
   twin's exposures; a merge migration (reassign exposures to the surviving row)
   is still the lossless fix if it ever matters. Not worth it pre-production.
3. **No food rename/edit UI.** If a rename path ever ships, route the new name
   through `findDuplicateFood` too, or the v0.5.136 guard is bypassable.
4. **~~Tab lists are stale after cross-screen writes.~~** Done in v0.5.140 —
   all four tabs now reload on focus. Follow-up worth knowing about: the
   focus reload is unconditional, so switching tabs re-runs the queries every
   time. Fine at current data volumes (a handful of foods/exposures per
   family); if a family ever accumulates thousands of exposures, gate the
   reload on a store-level "data changed" counter instead.
5. **`app/(tabs)/log.tsx` still loads on mount only.** It was out of scope for
   v0.5.140 (it is a form, not a data list), but its child/food selector chips
   have the same staleness: add a food from the form's "+ Add New" link and the
   new food does not appear in the chip row until remount. Same one-line
   `useFocusEffect` swap — but check the interaction with the form's
   `reset`/`watch` state before doing it blind.
6. **Tooling gotcha:** plain `bun test` invokes bun's *built-in* test runner,
   which hangs on this jest-expo suite. Use `bun run test` or `npx jest`.
   (CLAUDE.md's "How to Run" section still says `bun test`.) Also: in a fresh
   worktree/CI environment `bun install --frozen-lockfile` fails under newer
   bun versions ("lockfile had changes"); plain `bun install` works — discard
   the resulting `bun.lock` churn rather than committing it. Also: `bun` may
   not be installed at all in a fresh worktree — `npm install --legacy-peer-deps`
   works (plain `npm install` fails ERESOLVE: `react-test-renderer@19.2.8`
   peer-wants `react@^19.2.8` but the project pins `react@19.2.0`). Both
   `node_modules/` and `package-lock.json` are gitignored, so this leaves no
   trace; consider realigning the `react-test-renderer` pin so plain npm works.

## NOT in scope (unchanged from original review)

- **Wire Convex** — deferred until real multi-device need. Schema is ready.
- **Co-parent family invites UI** — `families.inviteCode` exists; Join flow works; no invite-share UI needed yet.
- **Food chaining** (`convex/foodChains.ts`) — advanced SOS technique, later.
- **Gamification/streaks/badges** — research warns against pressure-based interventions. Bright red line.
- **App Store / TestFlight** — off the table per user instruction.

## Do Not

- Do not wire Convex. Revisit later.
- Do not break the existing tests. Add new; do not refactor existing unless a test is wrong.
- Do not introduce an analytics SDK beyond the existing PostHog wrapper, feature flags, or i18n. YAGNI.
- Do not change `app.json` or `eas.json`.
- Keep following the CLAUDE.md versioning rules: bump `APP_VERSION`, add a changelog entry, run the full suite before every commit.
