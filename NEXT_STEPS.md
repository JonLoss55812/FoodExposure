# NEXT_STEPS.md

Reviewed at: v0.5.169 — 777 tests passing across 41 suites, TypeScript clean.

> **Read this first.** This file was last *fully* rewritten at v0.5.160 and the
> "Recently shipped" list below lags reality. A session in between added screen
> suites for the two onboarding screens, the food-detail bump-stage / safe-food
> paths, and the Settings CSV export without refreshing this file — and the
> v0.5.162 session then wasted a task re-testing a screen that was already
> covered. **Before picking work from the gap list, check `git log` and
> `find app -name '*.test.tsx'` against the claim you are about to act on.**

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
- v0.5.149 — screen tests for `app/food/add.tsx` (10): the v0.5.136
  duplicate guard (case-insensitive and whitespace-padded collisions alert
  and write nothing), the schema rejection path, the family-scoped insert,
  both Alert actions, and the failure path where a failed lookup must not
  fall through to the insert. Five mutations verified.
- v0.5.150 — screen tests for `app/(tabs)/log.tsx` (9): the
  required-selection guards, the happy-path insert (optional dimensions
  land as `null`), the `tolerate` default, the v0.5.7 reset (keep child,
  clear food), and both failure paths. Seven mutations verified.
- v0.5.151 — the duplicated screen-test seams extracted into
  `src/test-utils/screen-helpers.tsx` (`SAFE_AREA_METRICS`, a `SafeArea`
  wrapper, `click`, and the two Alert helpers). All five screen suites now
  import them instead of carrying private copies.
- v0.5.152 — screen tests for `app/(tabs)/foods.tsx` (11): the pinned
  safe-foods row (present once, absent when empty), per-food exposure
  counts, the skipped exposures query when no child is selected, search
  and category filtering, both empty states plus Clear Filters, and the
  load-failure path. Six mutations verified.
- v0.5.157 — screen tests for `app/(tabs)/index.tsx` (11): the dashboard's
  three summary numbers, including the load-bearing v0.5.85 Foods Tracked
  case (a food whose only exposures carry an unknown stage is still counted,
  and the two implementations only diverge when such a row exists), the
  highest-stage bucketing, recent-activity routing, both empty states, the
  load failure, and the not-onboarded redirect. Five mutations verified.
- v0.5.158 — screen tests for `app/(tabs)/progress.tsx` (11): the three
  early-return branches and their CTAs, per-food threshold rows, the reached
  marker, truncation, the rating-gated gauge, and the load failure. Six of
  seven mutations verified; the seventh is documented as unreachable (see
  gap #7 below).
- v0.5.159 — screen tests for `app/child/add.tsx` (10), gap #1's last named
  target: the `selectChild` call that makes a newly added child the selection,
  the three schema-owned rejections (whitespace name, US-style date, future
  date) each issuing zero writes, the family-scoped insert with optionals as
  `null`, and the retryable insert failure. Six mutations verified.
- v0.5.160 — a food's **category** is now editable from the detail page
  (closes gap #3 follow-up (a)). Chip row on the category tag; picking a chip
  is the commit (closed enum, so no Save step and no uniqueness guard);
  re-picking the current one is a no-op. +4 screen tests, six mutations
  verified.
- v0.5.143 — plain `npm install` works from a wiped tree (closes gap #6):
  dropped the deprecated unused `@testing-library/jest-native`, pinned
  `react-test-renderer` to 19.2.0, added `babel-preset-expo` as an explicit
  devDependency. CLAUDE.md's `bun test` corrected to `bun run test`.

## Shipped in the v0.5.162 session (2026-09-08)

- v0.5.161 — a food's **default preparation** is editable from the detail page,
  closing gap #3's last named follow-up. It was also not *displayed* there at
  all, so a value set on Add Food was write-only. Chip row on a new tag beside
  the category tag. One deliberate difference from the category editor and it
  is the load-bearing half: the field is nullable, so re-tapping the selected
  chip **clears** it to `null` (v0.5.137 deselect contract) rather than being a
  no-op close — otherwise a mis-tap would be permanent all over again. +5
  tests, four mutations verified.
- v0.5.162 — the Add Child form is written **once**, in
  `src/components/ChildForm.tsx`, shared by `app/child/add.tsx` and
  `app/onboarding/add-child.tsx` (gap #1's dedup note). 505 lines across two
  files -> 361 across three. No new tests by design: the 34 existing tests
  across the two host suites pass untouched, and dropping `selectChild` from
  the shared component now fails three tests across *both* suites where before
  it would have failed only one file's.

## Shipped in the v0.5.164 session (2026-09-08)

- v0.5.163 — **delete a single exposure** from the food detail page. A
  mis-logged exposure was permanent: it inflates the per-food count the
  15/20/30 threshold is read from and can fix the food's highest reached stage
  at a level the child never reached, and the only removal path was the
  v0.5.138 Delete Food cascade, which discards *every* exposure for that food
  across every child. Confirm Alert, delete scoped to the exposure id, local
  patch, and — the load-bearing half — `highestStage` recomputed from the
  remaining rows so the "Bump to X" target moves back down. +6 tests, five
  mutations verified. `createMockDb()`'s recorded delete now carries its
  `where` predicate so scoping is assertable.
- v0.5.164 — **backdate an exposure** on the Log form. `occurredAt` was always
  `new Date()`, so logging the morning after recorded the wrong day on every
  date-bucketed surface and in the therapist CSV. Optional `YYYY-MM-DD` field,
  `exposureSchema.occurredOn` (format / not-future / not-older-than
  `MAX_BACKDATE_YEARS`), and a pure `resolveOccurredAt` that parses at **local**
  midnight and keeps the current time when the named day is today. +18 tests,
  five mutations verified; a sixth test was removed as vacuous.

## Shipped in the v0.5.167 session (2026-09-10)

- v0.5.166 — **the CSV export's `date` column was rendered in UTC**, so it named
  the wrong calendar day for most of the world. Every other date surface in the
  app buckets by the *local* day (`getStartOfDay`, `formatRelativeDate`, and the
  v0.5.164 `resolveOccurredAt`, which parses a backdated `YYYY-MM-DD` at local
  midnight on purpose). An 8am exposure in UTC+10 is stored as 22:00Z the
  previous day: the dashboard said "Today", the therapist's CSV said yesterday.
  A backdated row was worse — stored at local midnight, it always exported one
  day early for every UTC+ user, defeating the whole point of v0.5.164.
  `toIsoDate` is now an exported, pure `toLocalIsoString(value, offsetMinutes?)`
  emitting ISO-8601 with an explicit offset. +9 tests, three mutations verified.
  **Harness fact worth keeping:** jest's jsdom environment resolves the host
  timezone **once** and ignores later writes to `process.env.TZ` — measured. A
  test that flips TZ and asserts a rendered date silently asserts nothing. That
  is why the offset is a parameter; do the same for any future date rendering.
- v0.5.167 — **correct a logged exposure's stage in place** from the food detail
  page (closes the edit half of gap #-1). v0.5.163 made an exposure deletable
  but not editable, so a mis-tapped stage could only be fixed by
  delete-and-re-log, losing the row's `createdAt` and every optional dimension.
  Chip row per history row, following the v0.5.160 category editor; the
  load-bearing half is recomputing `highestStage` in **both** directions so the
  "Bump to X" target follows a correction up as well as down. +6 tests, seven
  mutations verified. `createMockDb()` now records an **update**'s `where`
  predicate too (v0.5.163 did this for `delete`); the eight existing exact
  `toEqual` update assertions gained `where: expect.anything()`.

## Shipped in the v0.5.169 session (2026-09-11)

- v0.5.168 — **correct a logged exposure's rating** in place. Follows the v0.5.161
  *preparation* editor, not the v0.5.160 category one, and that is the whole point:
  `rating` is nullable, so re-tapping the selected chip **clears** it to `null`
  (v0.5.137 deselect contract) rather than being a no-op close. No `getHighestStage`
  recompute — unlike stage, rating feeds no derived value on this screen. One
  structural change rides along: the per-row busy condition, previously duplicated at
  five sites as `deletingExposureId !== null || savingStageId !== null`, is now a
  single `rowBusy` local. Not cosmetic — the editors patch `exposuresList` rather than
  reloading, so two concurrent per-row writes would race on the same list and one
  would silently clobber the other. +5 tests, six mutations verified.
- v0.5.169 — **correct a logged exposure's notes** in place. Free text, so it follows
  the v0.5.145 rename editor (inline `TextInput` seeded from the stored note,
  explicit Save/Cancel) rather than a chip row, validated through
  `exposureSchema.shape.notes`. Two consequences of routing through the schema are
  load-bearing: `optionalTrimmedText` trims, so a draft equal to the stored note after
  trimming is a no-op that never touches the DB; and it maps a blank draft to
  `undefined`, persisted as **`null`** — persisting `''` would leave a row reading as
  noted-but-empty on every surface that gates on truthiness. On failure the editor is
  left open with the draft intact. +7 tests, eight mutations verified.

## Known gaps worth doing next (discovered, deliberately not done)

-1. **An exposure's `occurredAt` is still not editable, and backdating has no date
   picker.** v0.5.164 added a validated free-text `YYYY-MM-DD` field on the Log form,
   which is the right MVP shape (no new dependency, reuses the
   `childSchema.dateOfBirth` precedent) but it is typing, on a phone, one-handed. A
   picker needs a package — `@react-native-community/datetimepicker` is the obvious
   one — so it is a deliberate deferral, not an oversight.
   **Stage (v0.5.167), rating (v0.5.168) and notes (v0.5.169) are now all correctable
   in place** on the food detail page. That leaves exactly one field:
   - **occurredAt** — the same free-text `YYYY-MM-DD` field the Log form has, routed
     through the existing pure `resolveOccurredAt`. Deliberately left for last and
     deliberately not rushed: unlike the other three, changing it moves the row on
     *every* date-bucketed surface (the dashboard's Today card, the Progress tab's
     trailing-7-day window, `formatRelativeDate`, and the therapist CSV's date
     column), so it wants the same care the stage edit got — and it is the one edit
     where the row's position in the list changes under the user, since the history is
     ordered by `occurredAt desc`. Decide explicitly whether the list re-sorts after
     the patch or stays put until reload; the current editors all patch in place and
     none of them has had to think about ordering.
   Templates for it: the v0.5.169 notes editor is the closest shape (free-text +
   explicit Save + schema validation), and `mock-db.ts` records an update's `where`
   predicate (v0.5.167) so a wrong-column scope is assertable.

   One thing worth knowing before adding a *fourth* per-row editor: the three that
   exist each carry their own `editingXId` / `savingXId` pair plus a latch, and the
   render now has three near-identical conditional blocks inside the history `map`.
   It is still readable at three; at four it is probably worth an
   `<ExposureRowEditors>` component or a single `editing: {id, field} | null`
   discriminated state. Judgement call, not a defect — flagged so the next session
   makes it deliberately rather than by accretion.

-2. **`resolveOccurredAt` is only reachable from the Log form.** The
   food-detail "Bump to X" one-tap action still writes `occurredAt: new Date()`
   with no way to backdate. That is defensible — a bump is an
   in-the-moment action — but if backdating turns out to matter there too, the
   helper is already pure and tested.

0. **Pre-existing `--noUnusedLocals` error.**
   `app/onboarding/__tests__/index.test.tsx:136` declares `errorSpy` and never
   reads it, so `npx tsc --noEmit --noUnusedLocals` fails on it. Plain
   `npx tsc --noEmit` (the project's standard check) is clean. One-word fix
   (drop the binding, keep the `jest.spyOn` call); left alone in v0.5.162 only
   to avoid touching another session's test file mid-refactor.

1. **Screen tests: 6 screens covered, harness proven.** v0.5.146 built
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
   - **Two harness limits found in v0.5.150, worth knowing before the next
     screen test.** (a) react-native-web does not serialize
     `accessibilityState.selected` to the DOM, so a chip's *highlight* is
     not directly assertable — assert the behaviour the selection enables
     instead (e.g. that Save re-validates cleanly rather than surfacing the
     "Select a food" error). (b) A screen's focus load runs exactly **once**
     under the harness, because `useFocusEffect` is mocked to a plain
     `useEffect` and nothing re-focuses the screen. Anything that only
     happens on a *second* load is therefore unreachable — which is why the
     v0.5.142 `resolveSelectedFoodId` repair on the Log form is covered by
     its unit tests and not through the screen. If that repair ever needs
     screen-level coverage, the honest way in is a test-only re-render that
     changes `familyId` (loadData's dependency), not a fake second focus.
   - **The shared seams now live in `src/test-utils/screen-helpers.tsx`**
     (v0.5.151): `SAFE_AREA_METRICS`, a `SafeArea` wrapper component,
     `click(label)`, and two Alert helpers. The Alert pair is deliberately
     two exports, not one with a flag: `confirmAlert` reads the **first**
     Alert (so a later failure Alert cannot be mistaken for a confirm
     dialog on a path that raises both) and `pressAlertButton` reads the
     **most recent**. Pick by which one the screen under test needs. The
     `expo-router` and `@/src/db/client` mocks stay per-file — they are
     `jest.mock` factories, which must be hoisted in the importing module.
   **All screens with real logic are now covered** (v0.5.159 closed the last
   one, `app/child/add.tsx`). What remains untested is `app/onboarding/index.tsx`
   (first-launch: two inserts + login + push), `app/onboarding/add-child.tsx`
   (a near-duplicate of `app/child/add.tsx` — worth *deduplicating* rather than
   testing twice; the two files differ only in the navigation they do on
   success and in the onboarding flag they set), and the two `_layout.tsx`
   files. None is high-value on its own.
   One harness note from v0.5.159/160, worth having before the next write-path
   test: `createMockDb().failReads()` covers **reads only**. To drive a write
   failure — which is how you reach a handler's catch block on a screen that
   issues no reads, like `app/child/add.tsx` — replace the mock's `insert` (or
   `update`) for one call and flip a flag to let the retry through; both new
   suites do this inline. If a third suite needs it, promote it to a
   `failWrites()` / `failNextWrite()` helper on `mock-db.ts` rather than
   copying the closure a third time.
   Three notes from writing the dashboard and Progress suites (v0.5.157/158):
   (a) a screen whose `loadData` depends on `selectedChildId` **loads twice**
   when the load itself changes the selection — `ensureSelection([])` on an
   empty family clears it, which recreates the callback and re-runs the mocked
   focus effect. Start such a test with the selection already null if you want
   an unambiguous read count. (b) Numbers are terrible `getByText` targets on
   stat-card screens; the same digit recurs in stage rows and category tiles.
   Scope through the label instead — see `statValue` in `progress.test.tsx`.
   (c) Text split by an expression (``{label} · {threshold}``) is still one
   element's `textContent`, so `getByText('Picky · 20')` works, but the label
   must be the config's exact value (`Picky`, not `Picky Eater`).
   Two notes from writing the Foods tab suite
   (v0.5.152): (a) `FlashList` *does* render under `jest-expo/web`,
   including its `ListHeaderComponent`, so a pinned header section is
   assertable; (b) `FoodCard` surfaces its exposure count only through
   `ProgressBar`'s `current/target` label, so assert `'2/15'`, not a
   phrase like "2 exposures".

2. **Legacy duplicate foods are not deduped.** v0.5.136 guards new adds only.
   With v0.5.138 a parent can now delete a twin manually, but that discards the
   twin's exposures; a merge migration (reassign exposures to the surviving row)
   is still the lossless fix if it ever matters. Not worth it pre-production.
3. **~~No food rename/edit UI.~~** **Fully closed as of v0.5.161** — name
   (v0.5.145), category (v0.5.160) and default preparation (v0.5.161) are all
   editable in place. `isSafeFood` was already toggleable from v0.3.0, so every
   field on `foods` can now be corrected without the delete-and-re-add that
   discards the exposure history the acceptance threshold is counted from.
   The one item that survives from this gap is (b): the rename does not
   normalize casing across the family, so pre-existing legacy duplicates are
   still separate rows — see gap #2. Original entry follows.
   Done in v0.5.145 — inline rename on the
   food detail page, validated through `foodSchema.shape.name` and guarded
   by `findDuplicateFood(..., excludeId)`. Follow-ups deliberately not done:
   ~~(a) only the *name* is editable~~ — category shipped in v0.5.160 (chip row
   on the category tag). **Default preparation is still not editable** and is
   the last field that requires delete-and-re-add; it is lower stakes than
   category was (it is display-only — nothing groups or counts by it), so it
   is a fill-in-the-gap job, not a data-integrity one. (b) the rename does not normalize casing
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

6. **~~Tooling gotcha.~~** *(v0.5.164 note: a fresh pusher worktree has no
   `node_modules` at all — `npm install` from a wiped tree took ~1 min and
   exited 0, and `bun` is not on PATH in that environment, so use
   `npx jest` there rather than `bun run test`.)* Mostly resolved in v0.5.143 — plain
   `npm install` now works and CLAUDE.md documents `bun run test`. Two
   residual items: (a) `bun.lock` was NOT regenerated for the v0.5.143
   `package.json` delta (three devDependency lines) because Bun is not
   installed in the worktree that made the change; the next Bun-equipped
   session should run plain `bun install` and commit the resulting lockfile
   churn deliberately. (b) `bun install --frozen-lockfile` still fails under
   newer Bun versions ("lockfile had changes"); plain `bun install` works.

7. **v0.5.43's threshold-tag refactor is not screen-observable, and that is
   fine.** Measured in v0.5.158: reverting the Progress header tag from
   `getThresholdForProfile(feedingProfile)` to `foodProgress[0]?.threshold ?? 15`
   leaves the whole suite green, on every profile. `calcProgressStats` derives
   each row's threshold from the same profile and the section is gated on a
   non-empty list, so the `?? 15` fallback is unreachable. The refactor guards
   a *future* per-row threshold override (a food-specific allergen threshold
   was the motivating example). Do not "fix" this by contriving a test —
   either accept the source shape as the guard, or, if per-row thresholds ever
   land, the tag becomes genuinely testable and should be covered then.

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
