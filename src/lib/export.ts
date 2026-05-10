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

export function buildExportFilename(childName: string, at: Date = new Date()): string {
  const slug = childName
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
