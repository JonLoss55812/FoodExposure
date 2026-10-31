# NEXT_STEPS.md

Reviewed at: v0.5.243. 1134 tests pass across 72 suites. `npx tsc --noEmit` and
`npx tsc --noEmit --noUnusedLocals` are both clean.

This file lists only **open** work. At v0.5.240 it was cut from a 72 KB session log, which
opened with a warning that it was stale, to the list below (critique-2026-10-23 #3). The
per-version history and the reasons behind each change are in `CHANGELOG.md`. To see the
old log, run `git show 376a284:NEXT_STEPS.md`.

**How to maintain it:** when you close an item, delete it; do not strike it through. Add
what you found and chose not to do under the right heading. Check `git log` before you act
on an item, because this file has lagged behind the code before.

## A. Product decisions for a human

1. **Two Convex directives contradict each other.** CLAUDE.md's "Next Priority" says to wire
   Convex (`fetchChildren` → `addFood` → `logFood`). Section D below says not to. One of
   them should be deleted. Until then, sessions treat Convex as out of scope.
2. **Join Family can be opened, but no screen shows the invite code.**
   `app/onboarding/join.tsx` looks codes up in local SQLite only, so it works only for a
   family created on the same phone (the copy says "on this device"). The options are to
   hide the Join link until sync exists, or to show the code in Settings, which is the
   out-of-scope invites UI. Do not describe Join as working across devices.
3. **A signed-in parent who has not finished onboarding cannot reach Join or Sign Out.**
   `resolveOnboardingEntryRedirect` sends them to Add Child, so a parent who meant to join
   has to add a child first and then sign out (v0.5.228).
4. **Join's "Name Already Taken" stops a signed-out parent from rejoining as themselves** on
   the same device. The v0.5.91 privacy reasoning is that there is no password. Each retry
   under a new name leaves another `users` row (v0.5.215).
5. **Stage and category colours used as graphics fall short of WCAG 1.4.11's 3:1.** Progress
   bar fills and stage dots measure about 1.9–2.7:1 on white. The text beside them carries
   the information.
6. **"This Week" means the last 7 local days, not a calendar week.** A calendar week needs a
   decision about which day the week starts on in each locale (v0.5.217).
7. **Backdating is typed, not picked.** The Log form and the per-row editor both take
   free-text `YYYY-MM-DD`. A picker needs a new dependency
   (`@react-native-community/datetimepicker`).
8. **Bump cannot be backdated.** "Bump to X" writes `occurredAt: new Date()`. If that needs
   to change, `resolveOccurredAt` is pure and tested.
9. **The merge silently keeps the survivor's spelling and row.** `describeMergeOutcome`
   names both categories when they differ (v0.5.214). Add more copy only if someone reports
   being surprised.
10. **Settings → Family offers two ways to rename a child:** the inline Rename (v0.5.175) and
    the `app/child/[id].tsx` screen. If the row feels crowded, drop the inline one and its
    6 tests.
11. **`age_months` is a per-row CSV column.** Moving age into a header row would break the
    CSV's single-header shape. Change it only if a therapist asks (v0.5.189).

## B. Needs a device or a running app

1. **The app has never been run.** This is the largest risk (critique #1). The flow tests
   mock navigation, so they do not replace a real run.
2. **Native globals are untested.** The suite runs on `jest-expo/web`, so it cannot see
   crypto, TextEncoder or structuredClone on native. The v0.5.180 move from `uuid` to
   expo-crypto was inferred from source. The first native build should check that
   onboarding, Add Food and Log Exposure all insert rows.
3. **On Android, a CSV export above about 1 MB fails** with "Failed to open share dialog".
   The fix is to write a file with expo-file-system (not installed) and share its URI,
   instead of passing a string to `Share.share` (`src/lib/export.ts:253`).
4. **On web, expo-sqlite probably cannot open.** COOP/COEP reach Metro's bundle responses but
   not the HTML at `/`. To check:
   - Run `npm run web` and read `crossOriginIsolated` in the console.
   - If it is false, the headers must reach the document. Expo CLI serves that page outside
     `enhanceMiddleware`.
   - A static host must send both headers itself.

   Details are in `.planning/pusher/documentation-2026-10-15.md`.
5. **Enforced foreign keys have not been seen on a device.** If `FOREIGN KEY constraint
   failed` appears, suspect an MMKV auth-store id with no matching SQLite row. Migration
   step 2 repairs rows, not the store.
6. **The error boundaries have not been seen working on a device.** That covers the
   per-screen boundaries, whether the root boundary catches provider errors, and
   `RouteErrorBoundary`'s "Go back". "Go back" needs `router.canGoBack()` to be true
   inside a modal. If it returns false, the link does not render.

## C. Code work that fits in a session

1. **Extract a `useGuardedWrite` hook from `app/food/[id].tsx`** (critique #3). The file has
   nine latches, and their release paths differ:
   - the no-op returns in category and rename release early;
   - Delete Food releases only on failure, because success navigates away;
   - the confirm-dialog handlers acquire inside the Alert callback.

   A hook has to keep all of these behaviours. v0.5.238's tests catch half of them if they
   are lost (`.planning/pusher/tests-2026-10-28.md`). Budget a whole session.
2. **`handleDeleteFood` guards on the `deleting` state, not on `deleteLatch.busy`.** The
   merge and delete-exposure handlers use `.busy`. A double tap can open two confirm
   dialogs, but the latch inside the callback still allows only one delete, so this is
   cosmetic. Switching to `.busy` would not stop the two dialogs either, because the latch
   is acquired inside the Alert callback (checked at v0.5.242). Treat this as a consistency
   edit for the C1 hook, not as a bug fix.
3. **Regenerate `bun.lock`.** It still lists `uuid`. A session with Bun installed should
   run a plain `bun install` (not `--frozen-lockfile`) and commit the result.
4. **Some dashboard reads are tested only against the mock.** `index-real-sql.test.tsx`
   covers today's count and the foreign-selection repair. It does not cover the children or
   recent-activity reads. Those reads change nothing, so this is low value.
5. **The food-detail Bump button stays visible when the selected child belongs to another
   family.** Tapping it shows "No child selected". Hiding it would add a read to `loadData`
   and reorder the queued reads in a 79-test suite. That was judged not worth it (v0.5.203).
6. **Tab focus reloads run every time.** At current data sizes that is fine. If a family
   reaches thousands of exposures, run them only when a store-level "data changed" counter
   has moved.
7. **The food-detail suite logs about 37 `act(...)` warnings.** They are only noise. Spend
   about 15 minutes on them only if they start hiding real failures.
8. **About 13 hand-written fail-once write overrides remain** in the `food/[id]`, `foods`,
   `log` and `settings` tests. Move one to `mockDb.failNextWrite()` only if it really means
   "fail the next write, then retry".
9. **Write more dark-mode render tests as screens are touched.** `setMockTheme('dark')` and
    `rgb()` from `src/test-utils/mock-theme.ts` switch the jest Unistyles mock and compare a
    computed colour with a theme token. `DatabaseProvider`, `RouteErrorBoundary`, `Button`,
    `FoodCard` and `ExposureCard` have dark render tests (v0.5.242). Not yet covered:
    `ChildSelector`, `EmptyState`, `RatingPicker`, `StageIndicator`, `ProgressBar` and every
    screen. Reset the theme in `afterEach`, and pair each dark assertion with a light one.
10. **The contrast suite does not check `CATEGORY_CONFIG` colours used as text.** No colour
    is used that way today. Add the check if one ever is.

### Caveats for future callers

- `fetchExportRows` with a blank `familyId` returns `[]`, and the export still shares a CSV
  with only the header. Settings blocks this case; a new caller should check the family
  first.
- A second `initDb` call made while the first is running returns without doing anything.
  If a caller ever needs to wait for init, keep the in-flight promise instead.
- The tab layout repairs the child selection on mount and when `familyId` changes, but not
  on focus. Settings Delete Child calls `ensureSelection(remaining)` itself, and any new
  delete path must do the same.
- A per-row editor that moves a row must sort with `compareExposuresNewestFirst`, not by
  subtracting `occurredAt` values.
- Before adding anything keyed by `selectedChildId`, grep for it. The new code must either
  run after `ensureSelection(kidsOfThisFamily)` or include a family predicate. Tests must
  sign in before they call `selectChild`.

## D. Out of scope, and things not to do

- **Out of scope:**
  - wiring Convex (see A1)
  - a co-parent invites UI
  - food chaining (`convex/foodChains.ts`)
  - App Store or TestFlight release
  - gamification, streaks or badges, a firm line because the feeding research warns
    against pressure
- **Do not:**
  - change `app.json` or `eas.json`
  - add analytics beyond PostHog, feature flags or i18n
  - skip the version bump, the `CHANGELOG.md` entry or the full suite run
- **Do not add a uniqueness check to child rename.** Add Child has none, so the check
  would reject a name that Add Child accepts.
- **Duplicate-food grouping is exact after normalising, on purpose.** "Brocolli" and
  "Broccoli" stay separate.
- **`mergeFoods`:** the merge-into-self guard and deleting the source row last are both
  needed; neither is extra caution.
- **The per-screen family predicates are now a second layer of defence.** Do not add more
  of them, and do not remove the existing ones without a reason.
- **Keep the 4 "only one row editor is open at a time" tests** if an `<ExposureRowEditor>`
  component is ever extracted.
- **Some mutations cannot be caught, so do not write tests for them:**
  - second taps on the in-flight latches, which `in-flight.test.ts` already covers
  - the `saving !== null` term in `rowBusy`, and the field check in `isSaving`
  - the food load's `!familyId` early return
  - the `?? 15` fallback on the threshold tag
  - `DatabaseProvider`'s spinner colour, which react-native-web does not expose
- **These are accepted as they are:**
  - exposures logged in the same second tie on `createdAt`, because timestamps are stored
    in whole seconds
  - the lower date bounds compare UTC instants
  - Bump stays enabled while a row write is in progress

## E. How to work here

- **A fresh pusher worktree has no `node_modules`.** Run `npm install` first (about a
  minute). Use `npx jest`, and never run a bare `bun test`.
- **`--testPathPatterns` is a regex.** The parentheses in `app/(tabs)/` are read as a regex
  group, so match on the file name (`foods.test`). Always read the `Tests:` summary line.
- **Screen-test seams:**
  - mock `expo-router` with a `mock`-prefixed variable, plus `useLocalSearchParams`, and
    `useFocusEffect` as a plain `useEffect`
  - mock `@/src/db/client` with a getter
  - wrap tab screens in `SafeArea`
  - use `confirmAlert` for the first Alert and `pressAlertButton` for the latest one
- **`createMockDb`:**
  - it never evaluates `where` on reads
  - `failReads()` affects reads only; use `failNextWrite()` for writes
  - narrow `writes` on `kind` before you read `.values`
  - a load that depends on `selectedChildId` runs twice if it changes the selection, so
    start those tests with no child selected
- **Real SQL:** use `createSqliteDb()` with `seedTwoFamilies` (`node:sqlite`, foreign keys
  on). A query-plan test must name the index it expects.
- **react-native-web limits:** it does not put `accessibilityState.selected` or `.disabled`
  in the DOM, though `aria-busy` is there. Assert the behaviour a selection enables
  instead. `FoodCard` counts render only as `'2/15'`.
- **Dates:**
  - jsdom fixes the timezone once, so pass offsets in as parameters
  - build fixtures with local `new Date(y, m, d, h)`
  - fixed 2026 fixture dates must stay in the past, because the not-future check reads
    `Date.now()`
- **Schema changes:** append a step to `MIGRATIONS`. Never edit step 1 or
  `0000_init.sql`.
- **Mutation-check every new test.** `.planning/` is gitignored, so commit reports kept
  there with `git add -f`.
