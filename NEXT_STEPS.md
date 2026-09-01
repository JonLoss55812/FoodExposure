# NEXT_STEPS.md

Reviewed at: v0.5.148 — 615 tests passing across 32 suites, TypeScript clean.

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
- v0.5.142 — the Log Exposure form reloads on focus (closes gap #5) and
  repairs a `foodId` naming a food deleted since the last load, via a new
  pure `resolveSelectedFoodId` helper (+7 tests).
- v0.5.144 — every async write handler is guarded by a *synchronous*
  in-flight latch (`src/lib/in-flight.ts`) instead of a render-lagged
  `useState` boolean; two handlers had no guard at all.
- v0.5.145 — rename a food from the detail page (closes gap #3). Routed
  through `findDuplicateFood`, which gained an `excludeId` param so a food
  does not collide with itself on a case-only fix.
- v0.5.146 — first screen render harness (closes gap #1's blocker):
  `src/test-utils/mock-db.ts` + `app/onboarding/__tests__/join.test.tsx`.
- v0.5.147 — screen tests for `app/food/[id].tsx` (13): the v0.5.145 rename
  (schema rejection, no-op, duplicate collision, the load-bearing case-only
  `excludeId` fix, happy path, latch release, cancel) and the v0.5.138 delete
  cascade (confirm copy, cancel, confirm + replace), plus not-found and
  read-failure. Five source mutations each fail exactly one test.
- v0.5.148 — screen tests for the Settings Delete Child flow (8): cascade,
  row drop, and the three `ensureSelection` repair outcomes (selected child
  deleted -> survivor; last child deleted -> null; other child deleted ->
  unchanged), plus the retryable failure path. Five mutations verified.
- v0.5.143 — plain `npm install` works from a wiped tree (closes gap #6):
  dropped the deprecated unused `@testing-library/jest-native`, pinned
  `react-test-renderer` to 19.2.0, added `babel-preset-expo` as an explicit
  devDependency. CLAUDE.md's `bun test` corrected to `bun run test`.

## Known gaps worth doing next (discovered, deliberately not done)

1. **Screen tests: 3 screens covered, harness proven.** v0.5.146 built
   `src/test-utils/mock-db.ts` (structural fake of the drizzle builder:
   queue reads, assert recorded writes, `failReads()` for catch blocks).
   v0.5.147 and v0.5.148 copied the pattern to `app/food/[id].tsx` and the
   Settings Delete Child flow — both destructive cascades are now covered.
   The seams, and the gotchas that cost time:
   - `jest.mock('expo-router', ...)` must reference a variable whose name
     starts with `mock` (jest's out-of-scope guard rejects a plain `router`).
     Add `useLocalSearchParams` for `[id]`-style routes and `useFocusEffect`
     (mock it to a plain `useEffect`) for any screen that loads on focus.
   - Mock `@/src/db/client` with a **getter** so each test's fresh
     `createMockDb()` is picked up: `{ get db() { return mockDb.db; } }`.
   - **Tab screens need a `SafeAreaProvider` wrapper** with static
     `initialMetrics` — `SafeAreaView`'s hook throws without one. This failed
     all 8 settings tests on the first run; see `settings.test.tsx`.
   - A confirm `Alert` is testable by reaching into the spy's third argument
     and invoking the named button's `onPress` inside `act` — see the
     `confirmAlert` helper, duplicated in both files (worth extracting into
     `src/test-utils/` if a third screen needs it).
   - The suite runs on `jest-expo/web` + `@testing-library/react`, so query
     by `accessibilityLabel` (`getByLabelText`) and use `fireEvent.change`
     with `{ target: { value } }` for TextInputs, not `changeText`.
   - react-native-web does **not** serialize `accessibilityState.disabled`
     to `aria-disabled` on a Pressable; `aria-busy` (v0.5.46) does serialize.
   - **Known harness limit:** react-native-web never dispatches a second
     press while the first is in flight, so the same-tick double-tap that
     `createInFlightLatch` exists for is *not* reachable from a DOM test.
     A two-tap test will pass with the latch deleted. Do not write one —
     `in-flight.test.ts` owns those semantics. Mutation-test any new screen
     test before trusting it; every test in all three files shipped only
     after independent source mutations each failed exactly one assertion.
   - **Known cosmetic wart, unresolved:** screens that load in a
     `useEffect` emit "An update ... was not wrapped in act(...)" warnings
     (~37 for the food-detail suite). They are console noise only — the
     suites pass. Wrapping the render in `await act(async () => ...)` and
     draining microtasks inside the act scope did *not* silence them, and
     neither did the `console.error` spy that is already installed in
     `beforeEach`, which suggests the warnings are emitted outside the
     spy's window rather than that the act wrapping is wrong. Worth ~15
     focused minutes if it starts hiding real failures; not before.
   Remaining targets, in order: `app/(tabs)/log.tsx` (the form + focus
   reload + `resolveSelectedFoodId` repair), `app/food/add.tsx` (the
   v0.5.136 duplicate guard on the add path), `app/(tabs)/foods.tsx`.

2. **Legacy duplicate foods are not deduped.** v0.5.136 guards new adds only.
   With v0.5.138 a parent can now delete a twin manually, but that discards the
   twin's exposures; a merge migration (reassign exposures to the surviving row)
   is still the lossless fix if it ever matters. Not worth it pre-production.
3. **~~No food rename/edit UI.~~** Done in v0.5.145 — inline rename on the
   food detail page, validated through `foodSchema.shape.name` and guarded
   by `findDuplicateFood(..., excludeId)`. Follow-ups deliberately not done:
   (a) only the *name* is editable; category and default preparation still
   require delete-and-re-add, and category is the one that changes a food's
   grouping on the Progress tab; (b) the rename does not normalize casing
   across the family, so pre-existing legacy duplicates are still separate
   rows (see gap #2); (c) ~~the rename flow is untested~~ — covered by
   the 7 rename tests added in v0.5.147.
4. **~~Tab lists are stale after cross-screen writes.~~** Done in v0.5.140 —
   all four tabs now reload on focus. Follow-up worth knowing about: the
   focus reload is unconditional, so switching tabs re-runs the queries every
   time. Fine at current data volumes (a handful of foods/exposures per
   family); if a family ever accumulates thousands of exposures, gate the
   reload on a store-level "data changed" counter instead.
5. **~~`app/(tabs)/log.tsx` still loads on mount only.~~** Done in v0.5.142.
   Two follow-ups worth knowing: (a) the same "selection outlives the list"
   problem exists for `childId` — the store's `ensureSelection` repairs it
   for the tabs, but the Log form mirrors `selectedChildId` into form state
   via a `useEffect`, so a child deleted mid-session is repaired only because
   `ensureSelection` moves the store value. Worth confirming once a harness
   exists. (b) The focus reload is unconditional here too — see gap #4.

6. **~~Tooling gotcha.~~** Mostly resolved in v0.5.143 — plain
   `npm install` now works and CLAUDE.md documents `bun run test`. Two
   residual items: (a) `bun.lock` was NOT regenerated for the v0.5.143
   `package.json` delta (three devDependency lines) because Bun is not
   installed in the worktree that made the change; the next Bun-equipped
   session should run plain `bun install` and commit the resulting lockfile
   churn deliberately. (b) `bun install --frozen-lockfile` still fails under
   newer Bun versions ("lockfile had changes"); plain `bun install` works.

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
