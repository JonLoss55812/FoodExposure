# Top 3 Tasks for Session

## Context
- v0.5.0 is shipped, 188 tests passing, 88.5% line coverage.
- NEXT_STEPS.md priorities P1–P5 are all done. P6 (coverage uplift to 55%) already exceeded.
- Picks below are real bugs / testability gains found in scan.

---

## Task 1: log.tsx — surface inline validation errors

**Problem.** `app/(tabs)/log.tsx` destructures `errors` from `useForm` (line 30) but never displays them. If a parent taps "Save Exposure" without picking a child, food, or stage, zod fails silently — the button does nothing, no feedback. Real UX bug.

**Approach.**
- Add `<Text style={styles.error}>` lines beneath the Child, Food, and Stage sections wired to `errors.childId`, `errors.foodId`, `errors.stage`.
- Add `defaultValues.foodId: ''` so zod sees the empty value (currently undefined → may not surface error at all).
- Reuse the `error` style pattern from `app/food/add.tsx`.

**Verification.** Existing tests still pass; new no-op (this is presentational; would require a render test mocking ChildSelector + DB to test fully — defer that to a separate task and validate via code inspection).

**Risk.** Low; purely additive UI strings.

---

## Task 2: foods.tsx — distinguish "no foods" vs "no matches" empty state

**Problem.** `app/(tabs)/foods.tsx:184` shows EmptyState "No Foods Yet / Add Food" whenever `filteredFoods.length === 0`. But that fires even when the user has foods and just typed a search that matches nothing — misleading CTA pushes them to add a duplicate.

**Approach.**
- Branch on `foods.length === 0` (true empty) vs `foods.length > 0 && filteredFoods.length === 0` (filter miss).
- Filter-miss state shows different copy + a "Clear filters" pressable that resets both `searchQuery` and `selectedCategory`.
- Keep EmptyState component reuse.

**Verification.** Add a tiny pure helper in `src/lib/food-partition.ts` (`getEmptyStateKind`) returning `'none' | 'filtered' | 'has-results'`, unit-test it, then use it in `foods.tsx`.

**Risk.** Low; the helper is pure, the screen change is straightforward.

---

## Task 3: extract `calcProgressStats` pure helper from progress.tsx

**Problem.** `app/(tabs)/progress.tsx:43-134` mixes 80 lines of data crunching (stage counts, category counts, weekly exposures, per-food progress, foodsNearTarget) with React state. Untestable. The loadStats body is the most logic-dense untested code in the project.

**Approach.**
- Create `src/lib/progress-stats.ts` exporting `calcProgressStats(foods, exposures, profile)` returning the same `stats` shape used in the component.
- Add `src/lib/__tests__/progress-stats.test.ts` covering: empty inputs, weekly window boundary, highest-stage-per-food, ratings average with/without ratings, foodsNearTarget at 80% threshold, sort order.
- Replace the body of `loadStats` with one call to the helper; component now only owns React effects.

**Verification.** New helper tests pass + existing 188 tests still pass.

**Risk.** Medium — touches a hot screen. Mitigated by keeping the helper output shape identical and asserting via tests.
