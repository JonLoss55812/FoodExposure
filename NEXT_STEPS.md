# NEXT_STEPS.md

Reviewed at: v0.1.0 ... 130+ tests passing, 43.8% line coverage ... schema research-grounded, UI partially wired. CC-executable scope only.

## Premise Challenge

The earlier "wire Convex next" plan was engineer-brain. With no real users, cloud sync earns zero. And since real-world trials are off the table right now, the right use of CC time is **closing the gap between schema and UI** ... the SOS research is in `src/db/schema.ts`, the question is whether the parent-facing app actually reflects it.

Three correctness gaps are CC-shaped work. Do them in this order.

## What Already Exists (do not rebuild)

- `src/stores/child-store.ts:14` ... `selectedChildId: string | null`, persisted via MMKV. Multi-child plumbing is already in place.
- `src/components/ChildSelector.tsx` ... switcher component, 76 lines.
- `src/db/schema.ts:43` ... exposures table with full 6-stage hierarchy (tolerate/interact/smell/touch/taste/eat), ratings 1-5, texture, temperature, meal type, setting, `is_safe_food` flag.
- `src/components/StageIndicator.tsx` ... stage UI exists.
- All seven tab/food screens reference `stage` or `isSafeFood` already (verified via grep).

The research is in the data and mostly in the components. The bugs live in the seams.

---

## Priority 1: Null-Child Safety Pass (P1, ~2 hr CC)

**Problem.** `selectedChildId` defaults to `null`. If the app launches with children in the DB but no selection persisted, or if the selected child was deleted, every query that assumes a `childId` can crash or render an empty screen without explanation.

**Why this matters.** This is the entire app's hot path. Silent "no data" states look identical to "I have no kids logged yet" ... parent thinks app is broken.

**Files to touch.**
- `src/stores/child-store.ts` ... add `ensureSelection(children: Child[])` that picks the first child when `selectedChildId` is null or points at a deleted row.
- `app/(tabs)/_layout.tsx` ... call `ensureSelection` once on mount after children load; if `children.length === 0`, redirect to `/onboarding/add-child`.
- `app/(tabs)/foods.tsx`, `log.tsx`, `progress.tsx`, `index.tsx` ... every query keyed by `selectedChildId` must short-circuit to empty array, not crash, when id is null. Verify the React Query key array includes `selectedChildId`.

**Tests to add.**
- `src/stores/__tests__/child-store.test.ts` ... `ensureSelection` picks first child when null, re-selects when current id is missing from list, no-ops when current id is valid.
- `app/(tabs)/__tests__/foods.test.tsx` ... renders empty state (not crash) when `selectedChildId` is null.

**Done when.** Launch app with `selectedChildId` manually cleared in MMKV storage ... app routes cleanly to onboarding or auto-picks first child. No white screen. `bun test` passes, coverage on `child-store.ts` hits 100%.

---

## Priority 2: Exposure Hierarchy Audit (P1, ~3 hr CC)

**Problem.** Schema supports six stages. The log form might default to `eat` and bury the others behind a picker ... meaning parents never use the "smelled it, did not taste" logging path the research requires.

**Why this matters.** The entire differentiation from a generic food journal is the six-stage hierarchy. If the UX buries it, the app is a food journal with extra columns.

**Files to read first (CC should audit, not assume).**
- `app/(tabs)/log.tsx:1` (388 lines) ... how is `stage` picked? Default value? Is it visible above the fold?
- `app/food/add.tsx:1` (292 lines) ... can you set an initial stage when adding a new food?
- `src/components/StageIndicator.tsx` ... is this read-only or an input?
- `app/food/[id].tsx:1` (212 lines) ... does the food detail page show the current stage and let the user bump it up?

**Fixes (after audit ... may be partial).**
- If `stage` defaults to `eat` ... change default to `tolerate` (start of hierarchy) so the logging form encourages progression.
- Surface the stage picker as a 6-segment control at the top of the log form, not buried in a modal.
- On food detail: add a "bump to next stage" primary action. Research says stage movement IS the progress metric. Make it one tap.

**Tests to add.**
- Render test: log form shows all 6 stages as visible segmented options, not dropdown.
- Integration: bumping stage on food detail writes a new `exposures` row with the new stage, not mutating the old one.

**Done when.** A CC-run manual walkthrough (bun ios, log a food at each stage) succeeds, and a screenshot of the log form shows all 6 stages visible without scrolling on iPhone 15 Pro frame.

---

## Priority 3: Safe-Food Availability Surface (P2, ~2 hr CC)

**Problem.** `is_safe_food` exists in schema and is referenced in UI files, but core SOS principle says **preferred foods must always be visually present alongside new foods**. Current Foods tab may just show all foods with no "this is your safety net" visual distinction.

**Why this matters.** If a parent can't quickly see "what are my kid's safe foods right now" in one glance, they can't apply the technique. This is a one-line research ask: show safe foods pinned/starred.

**Files to touch.**
- `app/(tabs)/foods.tsx` ... add a pinned "Safe Foods" row at the top, filter `isSafeFood === true`, horizontal scroll. Everything else lists below.
- `src/components/FoodCard.tsx` ... add a star/anchor icon when `isSafeFood` is true.
- `app/food/add.tsx` and `app/food/[id].tsx` ... confirm the "mark as safe food" toggle exists. If not, add it.

**Tests to add.**
- `src/components/__tests__/FoodCard.test.tsx` ... renders safe-food indicator when flag is true, hides it when false.
- `app/(tabs)/__tests__/foods.test.tsx` ... safe-food row appears above general list when ≥1 safe food exists, collapses when zero.

**Done when.** Foods tab shows a visually distinct "safe foods" row at top. Test adds 2 foods, marks one as safe, asserts it appears in both sections correctly.

---

## Priority 4: Exposure Progress vs 15-Count Threshold (P2, ~2 hr CC)

**Problem.** Research says 8-15 exposures is the acceptance threshold for typical kids (15-20+ for picky, 20-30+ for ARFID). The app needs to show progress to that number per food, or parents can't tell "are we almost there."

**Files to touch.**
- `app/(tabs)/progress.tsx:1` (367 lines) ... audit what's currently charted. If it's total exposures over time, add a per-food "7 of 15" view.
- `src/components/ProgressBar.tsx` ... likely reusable.
- Consider a `src/lib/thresholds.ts` constant: `EXPOSURE_THRESHOLDS = { typical: 15, picky: 20, arfid: 30 }` ... let `settings-store.ts` pick which threshold to apply based on a new `feedingProfile` setting.

**Tests to add.**
- Unit test: progress calculation returns `{ current: 7, threshold: 15, pct: 0.47 }` for a food with 7 exposures under the `typical` profile.
- Component test: progress bar renders correctly at 0%, 50%, 100%, >100% (past threshold).

**Done when.** Progress tab shows per-food exposure counts against a visible threshold. Settings tab has a "feeding profile" selector (typical/picky/ARFID) that shifts the threshold.

---

## Priority 5: Data Export (P2, ~1 hr CC)

**Problem.** CLAUDE.md mentions "data export" in settings, but there is no cloud backend. Until there is, a CSV export is the only way to move data between devices or share with a feeding therapist. Common use case: therapist appointment, "show me what she ate this month."

**Files to touch.**
- `app/(tabs)/settings.tsx` ... add "Export Data (CSV)" row.
- `src/lib/export.ts` (new) ... query all exposures for `selectedChildId`, format as CSV with columns: date, food name, category, stage, rating, preparation, texture, meal, setting, notes. Write to a temp file via `expo-file-system`, open system share sheet via `expo-sharing`.

**Tests to add.**
- Unit test for the CSV formatter: handles commas in notes (quote-escape), empty fields, ISO dates.

**Done when.** Tap export in settings, iOS share sheet opens with `tonguetutor-{childName}-{yyyymmdd}.csv` attached. Test verifies CSV content matches a seeded DB.

---

## Priority 6: Coverage Uplift (P3, ongoing)

Current coverage: 43.8% lines. Targets for the above priorities bump it to ~55%. After Priority 5 ships, take a pass at the under-covered paths using `bun test:coverage` to find them. No new features ... just tests on existing code.

Files likely under-tested (confirm via coverage report):
- `src/db/client.ts` ... migration runner, error paths
- `src/providers/DatabaseProvider.tsx` ... init failure, retry
- `app/onboarding/index.tsx`, `join.tsx` ... partially tested

**Done when.** Coverage hits 55%+ with no flaky tests. Each new test is deterministic (no time, no network, no random).

---

## NOT in Scope (explicit defer)

- **Wire Convex.** Deferred until there is real multi-device or multi-parent need. Schema is ready; do not wire the hook layer yet.
- **Co-parent family invites.** `families.inviteCode` exists in schema ... no reason to build the UI yet.
- **Food chaining feature** (`convex/foodChains.ts`). Advanced SOS technique; worth building only after 1-5 ship.
- **Charts redesign.** Keep basic charts. Revisit after data export reveals what parents actually want to see.
- **Gamification, streaks, badges.** Research warns against pressure-based interventions. Bright red line ... do not add until someone with clinical background greenlights it.
- **App Store / TestFlight.** Off the table per user instruction.

## Ordering Rationale

1-2 are correctness. Null-child and hierarchy-in-UI are defects masquerading as features. Fix first.

3-4 are research alignment. Safe-food surfacing and threshold progress are the two ideas that make this app meaningfully different from a food journal. High leverage.

5 is a genuine feature that ships offline value (therapist visits) without needing a backend. Small and contained.

6 is hygiene.

## Failure Modes to Watch

| Codepath | Failure | Rescued? | Fix |
|---|---|---|---|
| `selectedChildId` null + `children[0]` undefined | Crash accessing `.id` | GAP | P1 handles via `ensureSelection` + empty redirect |
| Stage dropdown defaults to `eat` | Research-breaking silent bug | GAP | P2 changes default + surfaces picker |
| CSV export with commas in notes | Malformed CSV | Test it | P5 includes quote-escape test |
| Exposure count query without `childId` filter | Leaks Kid 2 exposures into Kid 1 progress | UNCLEAR | P1 audits every query |
| MMKV storage corrupted across upgrade | Child store crashes | N | Add a try/catch + fallback to null in `child-store.ts:7-11` |

## Version Plan

- P1 merged: `v0.1.1` (bugfix)
- P2 merged: `v0.2.0` (hierarchy UX is a minor feature)
- P3 merged: `v0.3.0`
- P4 merged: `v0.4.0`
- P5 merged: `v0.5.0`
- P6: no version bump, continuous

Update `CLAUDE.md` Changelog with each merge.

## Do Not

- Do not wire Convex. Revisit later.
- Do not break the existing 130 tests. Add new; do not refactor existing unless a test is wrong.
- Do not introduce an analytics SDK, feature flag system, or i18n framework. YAGNI.
- Do not change `app.json` or `eas.json` unless the priority explicitly requires it. None do.
- Do not add `rescue Exception` / `catch (e)` blocks as band-aids around P1. Name the error, handle it explicitly.
