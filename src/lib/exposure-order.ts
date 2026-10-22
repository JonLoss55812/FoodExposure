import { desc } from 'drizzle-orm';
import * as schema from '@/src/db/schema';

/**
 * Newest first, and deterministic on ties. Exposures tie on `occurredAt` far
 * more than you would guess: a backdated row is stored at local midnight of
 * the named day (v0.5.164) and drizzle keeps whole seconds, so several rows
 * logged for "yesterday" share one instant. `occurredAt` alone leaves their
 * order to the query planner, which then differs between the screens and the
 * CSV, and lets the dashboard's `LIMIT 10` drop a different row per load.
 * `createdAt` breaks the tie by when the row was actually logged.
 */
export const EXPOSURES_NEWEST_FIRST = [
  desc(schema.exposures.occurredAt),
  desc(schema.exposures.createdAt),
] as const;

type Instant = Date | number | string;

/**
 * The in-memory twin of `EXPOSURES_NEWEST_FIRST`, for a screen that patches a
 * loaded list instead of reloading it (the food detail page's date editor).
 * It must order ties exactly as the query does, or a row corrected onto a
 * tied day sits in a different place than the next load puts it. A missing
 * `createdAt` sorts as oldest, so rows without one never jump ahead.
 */
export function compareExposuresNewestFirst(
  a: { occurredAt: Instant; createdAt?: Instant | null },
  b: { occurredAt: Instant; createdAt?: Instant | null },
): number {
  const occurred = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  if (occurred !== 0) return occurred;
  const created = (row: { createdAt?: Instant | null }) =>
    row.createdAt == null ? -Infinity : new Date(row.createdAt).getTime();
  const ca = created(a);
  const cb = created(b);
  return ca === cb ? 0 : cb > ca ? 1 : -1;
}
