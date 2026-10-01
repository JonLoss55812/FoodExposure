# NEXT_STEPS.md

Reviewed at: v0.5.187 — 908 tests passing across 49 suites, TypeScript clean.
`npx tsc --noEmit --noUnusedLocals` is **also** clean as of v0.5.178 (gap #0 closed),
so a new unused binding will now show up against a clean baseline rather than hiding
behind a pre-existing failure.

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

## Shipped in the v0.5.172 session (2026-09-14)

- v0.5.171 — **correct a logged exposure's date** in place, the last field named in
  gap #-1. Free-text `YYYY-MM-DD` editor per history row (the v0.5.169 notes shape),
  validated by `exposureSchema.shape.occurredOn` and resolved by `resolveOccurredAt`
  **passed the row's own timestamp as `now`** — that one argument makes a draft naming
  the day already stored resolve back to the stored instant exactly (so the row keeps
  its time of day instead of snapping to local midnight and reordering the history),
  and makes a blank draft a no-op without needing a clear-to-null branch, which would
  be illegal anyway since `occurredAt` is NOT NULL. The list is ordered by
  `occurredAt desc`, so this editor — unlike the other three — **re-sorts** after the
  patch. Seeded through a new pure `toLocalDateInput()` that reads local getters, for
  the v0.5.166 reason. +13 tests (9 screen, 4 unit), three mutations verified.
  **One branch was written, measured as unreachable under mutation, and deleted**: a
  separate blank-draft guard, fully subsumed by the no-op check. Recorded rather than
  shipped as an unfalsifiable `if`.
- v0.5.172 — screen tests for the Settings **Preferences card and Sign Out** (+5),
  the last uncovered paths on that screen. The load-bearing one is the v0.5.80
  contract that Sign Out calls **both** `clearChildSelection()` and `logout()`;
  dropping the first leaves the previous family's `selectedChildId` in MMKV, which on
  a shared device scopes the next person's first render to a child from a family they
  are not in, and then self-heals — a privacy leak that leaves nothing behind to catch
  by inspection. Four mutations verified. Harness note: the feeding-profile chips are
  labelled from `FEEDING_PROFILE_CONFIG`, whose label is the bare `ARFID`; query the
  config's exact value, same as the v0.5.158 Progress-tab note.

## Shipped in the v0.5.174 session (2026-09-15)

- v0.5.173 — **the SQLite migration is now executed by a test.** This closes the
  single largest untested surface in the repo: the migration lived in a template
  literal inside `DatabaseProvider`, a React component no test imports, which is
  exactly how v0.5.170 shipped a stray backtick that *terminated the enclosing
  literal* while all 777 tests stayed green — only `tsc` caught it. Every CHECK
  constraint from v0.5.123–v0.5.131 and every index from v0.5.170 had been
  asserted by inspection alone. The SQL moves to `src/db/migration.ts` as
  `MIGRATION_SQL` (provider 132 → 42 lines, string byte-identical apart from
  dedenting) and `src/db/__tests__/migration.test.ts` runs it against in-memory
  **`node:sqlite`** — Node 22+, no native module, same dialect, and the same
  harness v0.5.170 built ad hoc then discarded. **Use it for any future DB-layer
  work; that layer is no longer untestable.** 25 tests: exact table set,
  idempotency *and* row preservation across a re-run, the three indexes, the
  named index the planner picks for each of the four hot queries, the CHECK
  constraints rejecting 15 out-of-contract values, and — the half a
  rejection-only suite cannot see — three mirror tests that a constraint
  narrowed one step too far would fail (inclusive rating boundaries, every enum
  member, all nine optional dimensions still nullable).
  **One assertion was measured as too weak and tightened rather than shipped:**
  asserting only `USING INDEX` per query plan left the v0.5.170
  `(child_id, food_id)` regression **green**, because on an empty table the
  planner still reports an index for the `ORDER BY` before filtering. The
  assertion now names the expected index per query. If you add a query-plan
  test, name the index.
- v0.5.174 — **the four per-row exposure editors share one open-editor slot**
  (closes gap #-1 (b)). See that entry for the detail that matters.

## Shipped in the v0.5.176 session (2026-09-17)

- v0.5.175 — **rename a child in place** from Settings → Family. `children.name` was
  the last permanent-or-destructive field in the app: foods became correctable across
  v0.5.145/160/161 and every field on an exposure across v0.5.167–v0.5.171, but a
  mistyped child name could only be "fixed" by Delete Child, which cascades away every
  exposure that child has ever logged. Inline `TextInput` per row (the v0.5.169
  notes-editor shape), validated through `childSchema.shape.name`. **Deliberately no
  uniqueness guard**, unlike the food rename's `findDuplicateFood(..., excludeId)`:
  `children` has no uniqueness contract on the add path either, so one here would reject
  a rename that Add Child allows — do not "fix" that by adding one. +6 tests, seven
  mutations verified.
- v0.5.176 — **merge one food into another, losslessly** (closes gap #2). New
  `src/lib/merge-foods.ts`; wired into the **rename-collision Alert**, which is the only
  place a parent actually meets their legacy duplicates. Two things to know before
  touching it. (a) The source `foods` row is deleted **last** and the merge-into-self
  guard is load-bearing, not defensive noise: without it every exposure is reassigned to
  a row the last step then deletes. (b) Step 4 (`DELETE FROM food_chains WHERE
  source_food_id = target_food_id`) exists because rewriting both FK columns can turn a
  legitimate `dup -> keep` chain into a meaningless `keep -> keep` row. +13 tests, eight
  mutations verified.

## Shipped in the v0.5.178 session (2026-09-18)

- v0.5.177 — **duplicate foods are now visible on the Foods tab**, with the
  v0.5.176 lossless merge offered in place. Closes gap #2 follow-up (a).
- v0.5.178 — **a child's `dateOfBirth` and `notes` are read back** for the
  first time, on the Settings -> Family rows, via a new pure `formatChildAge`.
  Half-closes gap #-1.5 (read half only; the edit half still wants a detail
  screen — see the entry).
- chore — the long-standing `--noUnusedLocals` failure (gap #0) is fixed, so
  that strict check now passes from a clean baseline.

**Discovered this session and deliberately not done:**

- **A fresh pusher worktree still has no `node_modules`.** `npm install` took
  ~1 minute and exited 0, and `jest` is not on PATH until it finishes, so
  `npm run test` fails with `jest: not found` before then. Budget the minute;
  use `npx jest`. (Already recorded under gap #6, restated because it cost
  time again.)
- **`--testPathPatterns` is a regex, and `app/(tabs)/` contains regex
  groups.** `--testPathPatterns="tabs/__tests__/foods"` silently matches
  **zero** files and jest exits 1 with "No tests found" — which looks
  identical to a green run if you are grepping for `✕`. This wasted a full
  mutation-testing round that reported four mutations as "caught" when
  nothing had run at all. Match on the bare filename (`foods.test`) instead,
  and always assert on the `Tests:` summary line rather than the absence of
  failures.
- **`mockDb.writes` is a discriminated union**, so `writes[0].values` does not
  type-check — narrow on `kind` first (`w.kind === 'update' && w.values`).
  The existing suites avoid this by asserting `writes.map(w => w.kind)`, which
  is why it had not come up.
- **The merge banner's survivor choice is silent**, the same wrinkle gap #2(b)
  records for the rename-collision merge: the first row's spelling wins and the
  other's category / preparation / `isSafeFood` are discarded. Low stakes here
  (group members differ only in casing) and all three fields are editable in
  place, but it is worth a line in the confirm copy if anyone reports surprise.

## Shipped in the v0.5.181 session (2026-09-28)

- v0.5.180 — `generateId` / `generateInviteCode` use **expo-crypto**. `uuid` v4
  throws without a global `crypto.getRandomValues`, which Hermes lacks and nothing
  polyfilled, so every insert path would fail on a device build (the jest web
  preset has a global crypto, so the suite could not see it). Invite codes also
  moved off `Math.random`. `uuid` removed from `package.json`.
- v0.5.181 — Sentry `beforeBreadcrumb` / `beforeSend` redact drizzle's
  `params:` section (child names, notes) while keeping the SQL and stack.
  Closes audit finding #3.

**Unverified and worth a human check:** the Hermes crash in v0.5.180 is inferred
from the `uuid` and Expo sources, not observed on a device. **The first native
build (`npm run ios` / `android`) should confirm that onboarding, Add Food and
Log Exposure all insert.** More generally, this shows a blind spot: the suite runs
on `jest-expo/web`, so any native-only global (crypto, TextEncoder, structuredClone)
is invisible to it. If a dev build is ever available, a smoke run of the
onboarding path is the cheapest way to cover that class.

`bun.lock` still lists `uuid` (not regenerated, v0.5.143 precedent).

## Shipped in the v0.5.187 session (2026-09-30)

- v0.5.186 — root `ErrorBoundary` (`src/components/RouteErrorBoundary.tsx`,
  re-exported from `app/_layout.tsx`). Recovery screen + Try again, explicit
  `Sentry.captureException` (boundary-caught errors never reach Sentry otherwise),
  never renders `error.message`. Tests drive expo-router's real `Try` from
  `expo-router/build/views/Try` — a deep import; if an expo-router upgrade moves
  it, fix the import path, do not delete the tests.
- v0.5.187 — `childSchema.dateOfBirth` outputs `undefined` for blank; `ChildForm`
  back to `?? null`.

**Discovered and deliberately not done:**

- **Nested route boundaries.** Only the root layout exports one, so a crash in any
  screen replaces the *whole* app (tab bar included) with the recovery screen.
  Exporting the same component from `app/(tabs)/_layout.tsx` would keep the tab bar
  alive; not done because the root boundary is the safety net and the tab-level one
  is a UX nicety that needs a device to judge.
- **Not device-verified.** That the root boundary also catches errors thrown inside
  `DatabaseProvider` / the other providers follows from expo-router wrapping the
  route component, but nothing here proves it on a device.
- **`exposureSchema.occurredOn` still outputs `''` for blank.** Harmless — it is
  only fed to `resolveOccurredAt` — so left alone; same one-line transform if it
  ever gets persisted directly.

## Shipped in the v0.5.183 session (2026-09-29)

- v0.5.182 — `createMockDb().failNextWrite(error?)`: the next insert/update/delete
  rejects unrecorded, later writes succeed. Three suites' copy-pasted
  fail-once closures now use it. **~13 other write overrides remain** in
  `food/[id]`, `foods`, `log` and `settings` tests; most fail a *specific* write
  kind or inspect args first, so they are a different shape — migrate one only if
  it is genuinely "fail the next write, then retry".
- v0.5.183 — `app/child/[id].tsx`: DOB, notes, avatar and name editable via
  `ChildForm`'s new edit mode, reached by tapping a Settings → Family row. Closes
  gap #-1.5. Also fixed: a DOB typed then cleared on Add Child persisted `''`.

**Discovered and deliberately not done:**

- ~~**`childSchema.dateOfBirth` still outputs `''` for a blank input.**~~ Fixed in
  v0.5.187 with a trailing `.transform` — the output type did not change after all.
- **The Settings row now has two ways to change a name** — inline Rename
  (v0.5.175) and the detail screen. Both write the same column, so nothing is
  wrong, but if the row feels crowded, Rename is the one to drop (its 6 tests
  would go with it).
- **The detail screen does not refresh the Settings row on return by itself** —
  it relies on Settings' `useFocusEffect` reload, which already exists. Fine,
  but it is why the edit screen does not patch any store.
- **The load's family scoping is untested** — `createMockDb` serves queued rows
  without evaluating predicates. A predicate-recording read (like writes' `where`)
  would make that assertable; not worth building for one guard.

## Known gaps worth doing next (discovered, deliberately not done)

-1. **~~Every field on an exposure is now correctable in place.~~** Closed as of
   v0.5.171: stage (v0.5.167), rating (v0.5.168), notes (v0.5.169) and date
   (v0.5.171) are all editable from the food detail page's Exposure History, and an
   exposure is deletable (v0.5.163). Two follow-ups survive.

   (a) **Backdating is still typing, not a picker.** Both the Log form's v0.5.164
   field and the v0.5.171 per-row editor take a free-text `YYYY-MM-DD`. That is the
   right MVP shape (no new dependency, reuses the `childSchema.dateOfBirth`
   precedent) but it is one-handed typing on a phone. A picker needs a package —
   `@react-native-community/datetimepicker` is the obvious one — so it stays a
   deliberate deferral, not an oversight.

   (b) **~~Four per-row editors now share one render block.~~** Closed in
   v0.5.174: `editing: { id, field } | null` + `saving: { id, field } | null` +
   one `rowEditLatch` replace the eight id-valued slots and four latches, and
   `rowBusy` drops from five terms to two. All 63 existing editor tests passed
   untouched. **The one thing to know before touching it:** the collapse
   introduces exactly one new way to be wrong that per-field ids could not —
   forgetting to discriminate on `field`, so opening any editor opens all four
   on the row. That mutation left all 63 tests green when measured, so +4 tests
   in `only one row editor is open at a time (v0.5.173)` now pin it. Keep them
   if you extract an `<ExposureRowEditor>` component later; the render block is
   still long, it is just no longer holding eight pieces of state.
   Two mutations survive and are deliberate, not oversights: dropping the
   `saving !== null` term from `rowBusy`, and `isSaving`'s field
   discrimination. Both are unobservable from a DOM test — react-native-web
   does not serialize `accessibilityState.disabled`, and the single latch
   already prevents the concurrency `rowBusy` guards. Do not contrive tests
   for them.

   (c) **The date tests pin literal 2026 dates that must stay in the past.** The
   `occurredOn` schema's not-future refine reads `Date.now()`, so
   `app/food/__tests__/id.test.tsx`'s re-sort test uses `2026-09-12` and would have
   failed had it been written a week earlier — it was, once, with `2026-09-20`. The
   rest of the suite has the same shape (fixtures dated `new Date(2026, 0, 15)`). Not
   a defect today and not worth a fake-timer rewrite, but worth knowing before
   picking a date in a new test.

-1.5. **~~A child's `dateOfBirth` and `notes` are readable but still not
   editable.~~** **Closed in v0.5.183** (`app/child/[id].tsx`, `ChildForm` edit mode). *(Half closed in v0.5.178.)* The **read** half shipped: a new
   pure `formatChildAge(dateOfBirth, now?)` in `src/lib/utils.ts` (whole
   months under two — the unit feeding therapy works in for that range —
   years-and-months above it, local-midnight parse, no month counted until
   the day of the month is reached, `null` rather than a placeholder for
   blank / non-string / malformed / rollover / future input) and the
   Settings -> Family rows now show the age and the notes beneath each
   child's name, both collapsing when absent. **What survives is the edit
   half**, and the shape below is still the right one — do not bolt a third
   inline editor onto the Settings row. `formatChildAge` is ready-made for
   the detail screen when it lands. Original entry follows.

   **A child's `dateOfBirth` and `notes` are still write-only.** Both are
   captured by `ChildForm` on Add Child / onboarding and land in SQLite, and
   then **no surface in the app ever reads them back** — not Settings, not the
   dashboard, not the CSV export. Same defect class v0.5.161 closed for a
   food's `defaultPreparation` ("a value set on Add Food was write-only from
   the moment it was saved"). v0.5.175 made the *name* correctable but
   deliberately stopped there to stay inside one session's budget. The honest
   fix is not another inline editor bolted onto the Settings row — it is a
   `app/child/[id].tsx` detail screen reusing `ChildForm` in an edit mode
   (seed defaults from the row, issue an `update` instead of an `insert`, skip
   the `selectChild` call), with the Settings row navigating to it. That would
   also give DOB somewhere to be *displayed*, which is the actual reason a
   parent typed it. Budget it as a whole task: `ChildForm` is shared by two
   hosts and 34 tests, so the refactor needs its own verification pass.

-2. **`resolveOccurredAt` is only reachable from the Log form.** The
   food-detail "Bump to X" one-tap action still writes `occurredAt: new Date()`
   with no way to backdate. That is defensible — a bump is an
   in-the-moment action — but if backdating turns out to matter there too, the
   helper is already pure and tested.

0. **~~Pre-existing `--noUnusedLocals` error.~~** Closed in v0.5.178 —
   `app/onboarding/__tests__/index.test.tsx:136` kept the `jest.spyOn` call
   (it silences the handler's expected `console.error`) and dropped the unused
   binding; `afterEach`'s `jest.restoreAllMocks()` already tore it down. Both
   `npx tsc --noEmit` and `npx tsc --noEmit --noUnusedLocals` are clean.

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
   suites do this inline. **Done in v0.5.182:** use `mockDb.failNextWrite()`.
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

2. **~~Legacy duplicate foods are not deduped.~~** Closed in v0.5.176 —
   `mergeFoods` reassigns the twin's exposures to the surviving row instead of
   discarding them, offered from the rename-collision Alert. Two follow-ups
   survive, neither urgent. ~~(a) The merge is only reachable from a rename
   *collision*.~~ Closed in v0.5.178: a new pure `findDuplicateFoodGroups`
   (`src/lib/food-partition.ts`) groups the library on the same normalized key
   `findDuplicateFood` compares on, and the Foods tab shows a banner naming the
   food and its copy count with a Merge action wired to `mergeFoods`. Three
   things to know before touching it. It reads **`foods`, not `filteredFoods`**
   — duplication is a property of the library, not of the current filter, and a
   search that hides one twin must not read as "the problem went away"; a test
   pins this. It offers **one group and folds one twin per tap** (the banner
   reappears while any duplicate remains) rather than queuing confirm dialogs
   over a destructive action. And the grouping is **exact after normalizing,
   deliberately not fuzzy** — it catches "apple"/"Apple" and stays silent on
   "Brocolli"/"Broccoli", which are two different strings a parent may be
   keeping apart on purpose. If anyone asks for fuzzy matching, that is a
   different feature with a much worse failure mode (folding away a row that
   was wanted), not a missing case here. (b) The merge keeps the *target* row's category,
   preparation and `isSafeFood` wholesale and discards the source's. That is
   the right default (the parent picked the surviving name deliberately) and
   all three are now editable in place, but it is a silent choice — worth a
   line in the confirm copy if anyone reports surprise.
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
