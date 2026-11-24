# Performance — 2026-11-24

**Outcome: I found nothing measurably slow, so I changed no code.**

## Baseline

- `npx jest`: 1264 tests pass across 77 suites. No code changed, so the count is the same at the end.
- `npm install` succeeded cleanly this time. The ERESOLVE noted on 2026-11-03 is fixed.

## 1. Regression check against the 2026-11-03 harness

I re-ran `performance-2026-11-03.bench.ts.txt` unchanged: real SQL through `createSqliteDb()`,
3 children × 200 foods × 40 exposures = 24,000 exposures, median of 15 runs.

| Path | 2026-11-03 | 2026-11-24 |
|---|---|---|
| Dashboard | 12.1 ms | 13.2 ms |
| └ recent-10 join | 0.67 ms | 0.67 ms |
| └ stage-history read | 8.9 ms | 9.6 ms |
| Foods tab | 11.4 ms | 12.3 ms |
| Progress tab | 19.9 ms | 22.0 ms |
| └ calcProgressStats alone | 2.5 ms | 2.4 ms |
| Food detail | 0.92 ms | 0.93 ms |
| Log tab | 1.27 ms | 1.33 ms |
| CSV export | 20.2 ms | 20.9 ms |

Every path is within about 10% of the earlier run. That is machine noise; the pure-helper
times did not move. The query plans are unchanged: the child-scoped reads still use the
v0.5.170 indexes.

## 2. New code since the last report

59 commits have landed since 2026-11-03. The only one that adds work to a hot path is
`ddff478`, which made Foods search match on `normalizeNameKey` (NFC, trim, collapse inner
whitespace, lowercase). The function now runs on **every food name on every keystroke**,
in `filterFoods`, and again on every render in `findDuplicateFoodGroups`. I timed both
with a throwaway jest benchmark: 20 warm-up runs, then the median of 200.

| Foods in library | filterFoods (per keystroke) | findDuplicateFoodGroups (per render) |
|---|---|---|
| 200 | 0.13 ms | 0.15 ms |
| 2,000 | 1.1 ms | 1.5 ms |

At a realistic library size, both together cost about 0.3 ms per keystroke, which is far
below one 16 ms frame. Even a library ten times larger stays under 3 ms. Memoizing the
normalized keys or wrapping the calls in `useMemo` would add complexity and gain nothing
anyone could notice, so I left them alone.

## What would change this

The conclusion from 2026-11-03 still stands. The cost of expo-sqlite's JSI bridge on a
low-end Android device has not been measured. If a device profile shows a tab-focus read
above about 50 ms for a real family, try SQL-side aggregation first.
