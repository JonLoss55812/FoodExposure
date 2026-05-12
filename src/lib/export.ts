import { Share } from 'react-native';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';

export interface ExposureRow {
  occurredAt: Date;
  foodName: string;
  category: string;
  isSafeFood: boolean;
  stage: string;
  rating: number | null;
  preparation: string | null;
  texture: string | null;
  temperature: string | null;
  mealType: string | null;
  setting: string | null;
  notes: string | null;
}

const HEADER = [
  'date',
  'food',
  'category',
  'safe_food',
  'stage',
  'rating',
  'preparation',
  'texture',
  'temperature',
  'meal',
  'setting',
  'notes',
].join(',');

// CSV injection guard: Excel/Sheets/Numbers treat cells starting with
// `=`, `+`, `-`, `@`, tab, or carriage return as formulas. A note like
// `=cmd|'/c calc'!A0` could execute when a therapist opens the export.
// Per OWASP CSV Injection: prefix such cells with a single quote so the
// receiving spreadsheet renders the literal text without evaluating.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Reject non-finite numbers (NaN, ±Infinity) — String(NaN) emits the
  // literal "NaN" / "Infinity" text into the therapist-facing CSV.
  // Excel/Sheets render those as opaque strings that look identical to a
  // legitimate sample at a glance but break every downstream computation
  // (avg, sort, filter). Same drift class as v0.5.106 (Number.isFinite
  // guard on rating accumulation) and v0.5.120 (toIsoDate null guard).
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  const str = typeof value === 'string' ? value : String(value);
  const needsQuotes = /[",\n\r]/.test(str);
  const needsFormulaGuard = typeof value === 'string' && FORMULA_TRIGGERS.test(str);
  if (needsQuotes || needsFormulaGuard) {
    const guarded = needsFormulaGuard ? `'${str}` : str;
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return str;
}

function toIsoDate(value: Date | number | string): string {
  // `new Date(null)` coerces null to 0 and returns the Unix epoch
  // (1970-01-01T00:00:00.000Z), which has a valid .getTime() of 0 — so
  // the NaN guard below would let a corrupt exposures.occurredAt row
  // with a null value emit a date "before computers existed" into the
  // therapist-facing CSV. Early-return on null/undefined before the
  // Date constructor runs. Matches v0.5.96/v0.5.107/v0.5.114 invalid-
  // Date guard pattern.
  if (value === null || value === undefined) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

export function formatExposuresCsv(rows: ReadonlyArray<ExposureRow>): string {
  const body = rows.map((r) =>
    [
      toIsoDate(r.occurredAt),
      csvEscape(r.foodName),
      csvEscape(r.category),
      csvEscape(r.isSafeFood),
      csvEscape(r.stage),
      csvEscape(r.rating),
      csvEscape(r.preparation),
      csvEscape(r.texture),
      csvEscape(r.temperature),
      csvEscape(r.mealType),
      csvEscape(r.setting),
      csvEscape(r.notes),
    ].join(',')
  );
  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows opens with the correct
  // codepage. Without it, Excel defaults to ANSI/Windows-1252 and mangles
  // non-ASCII food names like "café" / "Crème brûlée" / "Schäl".
  return '\uFEFF' + [HEADER, ...body].join('\n') + '\n';
}

// Cap the slug at 50 chars so a corrupt childName row (no DB-level
// length constraint; the 50-char schema cap is enforced only on insert)
// can't produce a filename that overflows the 255-byte POSIX/HFS+ limit
// or trips share-sheet preview truncation. Applied AFTER sanitization
// so the cap doesn't leave the slug ending mid-stripped-char or with a
// trailing hyphen — matches the v0.5.111 deriveLocalEmailPart pattern.
const EXPORT_FILENAME_SLUG_MAX = 50;

export function buildExportFilename(childName: string, at: Date = new Date()): string {
  const safeName = typeof childName === 'string' ? childName : '';
  const slug = safeName
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, EXPORT_FILENAME_SLUG_MAX)
    .replace(/-+$/, '');
  const safeSlug = slug.length > 0 ? slug : 'child';
  const safeAt = at instanceof Date && !Number.isNaN(at.getTime()) ? at : new Date();
  const yyyy = safeAt.getUTCFullYear();
  const mm = String(safeAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(safeAt.getUTCDate()).padStart(2, '0');
  return `tonguetutor-${safeSlug}-${yyyy}${mm}${dd}.csv`;
}

export async function fetchExportRows(childId: string): Promise<ExposureRow[]> {
  const results = await db
    .select({
      occurredAt: schema.exposures.occurredAt,
      foodName: schema.foods.name,
      category: schema.foods.category,
      isSafeFood: schema.foods.isSafeFood,
      stage: schema.exposures.stage,
      rating: schema.exposures.rating,
      preparation: schema.exposures.preparation,
      texture: schema.exposures.texture,
      temperature: schema.exposures.temperature,
      mealType: schema.exposures.mealType,
      setting: schema.exposures.setting,
      notes: schema.exposures.notes,
    })
    .from(schema.exposures)
    .innerJoin(schema.foods, eq(schema.exposures.foodId, schema.foods.id))
    .where(eq(schema.exposures.childId, childId))
    .orderBy(desc(schema.exposures.occurredAt));

  return results.map((r) => ({
    ...r,
    occurredAt: r.occurredAt instanceof Date ? r.occurredAt : new Date(r.occurredAt as unknown as number),
  }));
}

export async function exportChildData(childId: string, childName: string): Promise<void> {
  const rows = await fetchExportRows(childId);
  const csv = formatExposuresCsv(rows);
  const filename = buildExportFilename(childName);
  await Share.share({
    title: filename,
    message: csv,
  });
}
