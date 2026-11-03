# Performance — 2026-11-03

**Outcome: I found nothing measurably slow, so I changed no code.**

## Baseline

- `npx jest`: 1152 tests pass across 73 suites (unchanged at the end).
- Note on setup: a fresh `npm install` **fails with ERESOLVE**. `package.json` declares
  `react-native-unistyles@^3.1.1`, and 3.8.0 (now published) peer-requires
  `react-native >= 0.85`, but the project pins 0.83.10. `bun.lock` still resolves 3.1.1.
  To get a baseline I installed with `--legacy-peer-deps` and then
  `npm install --no-save react-native-unistyles@3.1.1`. This is not a performance issue
  and is out of scope here, but the next dependencies session should fix it: tighten the
  range to `~3.1.1`, or bump to the highest 3.x that accepts RN 0.83.

## Harness

The harness was a throwaway jest test, kept at `performance-2026-11-03.bench.ts.txt`. To
re-run it, copy it to `src/lib/__tests__/` and run `npx jest --testPathPatterns=zz-bench`.
It uses real SQL: `createSqliteDb()` (node:sqlite, the shipped migrations, then `ANALYZE`),
seeded with **3 children × 200 foods × 40 exposures = 24,000 exposures**, which is 8,000
per child spread over 3 years. That is far larger than real use: 40 exposures on each of
200 foods per child. Each case runs the drizzle queries the screen runs plus its pure
helper. There are 3 warm-up runs, then the median of 15.

| Path (per focus) | median |
|---|---|
| Dashboard (children + today + recent-10 + stage history + computeStageCounts) | 12.1 ms |
| └ recent-10 join | 0.67 ms |
| └ full stage-history read | 8.9 ms |
| Foods tab (foods + 2-col history + buildFoodsWithStats) | 11.4 ms |
| Progress tab (foods + 4-col history + calcProgressStats) | 19.9 ms |
| └ history query via drizzle | 15.0 ms (14.3 ms without the family-scope join) |
| └ same query as raw `node:sqlite` | 11.3 ms |
| └ calcProgressStats alone | 2.5 ms |
| Food detail | 0.92 ms |
| Log tab | 1.27 ms |
| CSV export query (one-off user action) | 20.2 ms |

Query plans (`EXPLAIN QUERY PLAN`): every child-scoped read uses the v0.5.170 indexes.
`today` reads `idx_exposures_child_occurred` as a range. Recent-10 and food detail use
`idx_exposures_child_food_occurred`, followed by a temp B-tree sort. The sort is there
because `EXPOSURES_NEWEST_FIRST` added the `created_at` tie-break after the indexes were
built. It costs well under 1 ms at 8k rows per child. `foods ORDER BY name` scans and sorts
about 200 rows.

## Why I did not optimize

- **No N+1 pattern.** Each screen issues a fixed number of queries. The pure helpers
  (`calcProgressStats`, `computeStageCounts`, `buildFoodsWithStats`,
  `findDuplicateFoodGroups`) are single-pass `Map` bucketing, O(n).
- **The remaining cost is reading the rows, not the code.** The largest read is the full
  per-child history that Dashboard, Foods and Progress each make. At an extreme 8k rows
  it costs about 9–15 ms, and raw SQLite alone accounts for 11.3 ms of the 15 ms. The only
  lever left is aggregating in SQL (GROUP BY food, a CASE-ranked max stage, a SQL weekly
  count and average rating). That would re-implement in SQL the unknown-stage skipping and
  the [1,5] rating gate that `calcProgressStats` handles. That is a real correctness risk,
  and it would save roughly 10 ms only at data volumes no family reaches. At a realistic
  ~2k rows per child the read is about 3–4 ms.
- Adding a `(child_id, occurred_at, created_at)` index would remove the temp-sort step on
  recent-10. That query already takes 0.67 ms, so there is nothing measurable to gain, and
  every insert would pay for one more index entry.
- Rendering: the food detail page maps one food's exposure history into a ScrollView,
  bounded by the 15–30 threshold. Progress caps its list at `slice(0, 10)`. jsdom has no
  layout or frame timing, so render cost is not measurable here, and nothing in the code
  is suspicious.

## What would change this

All numbers are from node:sqlite on a dev machine. expo-sqlite's per-row JSI bridge cost on
a low-end Android device is **unmeasured**. If a device profile ever shows the Progress or
Dashboard focus above about 50 ms for a real family, SQL-side aggregation is the first thing
to try. Shared-history caching across the three tabs is the second.
