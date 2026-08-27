# NEXT_STEPS.md

Reviewed at: v0.5.139 — 557 tests passing across 27 suites, TypeScript clean.

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

## Known gaps worth doing next (discovered, deliberately not done)

1. **No screen render harness.** The single biggest remaining test gap: every
   `app/` screen (forms, handlers, conditional empty states) ships without tests
   because there is no jest harness for expo-router + drizzle + MMKV screens.
   Dozens of changelog entries cite the "ship-without-test pattern" for this
   reason. Setting up one working screen test (e.g. `app/onboarding/join.tsx`
   with mocked db/stores) would unlock testing the largest untested surface.
   Budget a full session; the mocking is the hard part, not the assertions.
   The two delete flows (v0.5.138/v0.5.139) are prime first candidates once a
   harness exists — destructive cascades with only manual verification today.
2. **Legacy duplicate foods are not deduped.** v0.5.136 guards new adds only.
   With v0.5.138 a parent can now delete a twin manually, but that discards the
   twin's exposures; a merge migration (reassign exposures to the surviving row)
   is still the lossless fix if it ever matters. Not worth it pre-production.
3. **No food rename/edit UI.** If a rename path ever ships, route the new name
   through `findDuplicateFood` too, or the v0.5.136 guard is bypassable.
4. **Tab lists are stale after cross-screen writes.** No tab uses focus-based
   reloading — Foods/Progress/dashboard load on mount + pull-to-refresh only,
   so e.g. a food deleted via v0.5.138 lingers on the Foods tab until refresh.
   Settings (v0.5.139) now demonstrates the `useFocusEffect` reload pattern;
   applying it to the three data tabs is a small, high-clarity follow-up.
5. **Tooling gotcha:** plain `bun test` invokes bun's *built-in* test runner,
   which hangs on this jest-expo suite. Use `bun run test` or `npx jest`.
   (CLAUDE.md's "How to Run" section still says `bun test`.) Also: in a fresh
   worktree/CI environment `bun install --frozen-lockfile` fails under newer
   bun versions ("lockfile had changes"); plain `bun install` works — discard
   the resulting `bun.lock` churn rather than committing it.

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
