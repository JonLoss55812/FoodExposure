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
