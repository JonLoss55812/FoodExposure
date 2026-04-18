import { Share } from 'react-native';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';

export interface ExposureRow {
  occurredAt: Date;
  foodName: string;
  category: string;
  stage: string;
  rating: number | null;
  preparation: string | null;
  texture: string | null;
  mealType: string | null;
  setting: string | null;
  notes: string | null;
}

const HEADER = [
  'date',
  'food',
  'category',
  'stage',
  'rating',
  'preparation',
  'texture',
  'meal',
  'setting',
  'notes',
].join(',');

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toIsoDate(value: Date | number | string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  return new Date(value).toISOString();
}

export function formatExposuresCsv(rows: ReadonlyArray<ExposureRow>): string {
  const body = rows.map((r) =>
    [
      toIsoDate(r.occurredAt),
      csvEscape(r.foodName),
      csvEscape(r.category),
      csvEscape(r.stage),
      csvEscape(r.rating),
      csvEscape(r.preparation),
      csvEscape(r.texture),
      csvEscape(r.mealType),
      csvEscape(r.setting),
      csvEscape(r.notes),
    ].join(',')
  );
  return [HEADER, ...body].join('\n') + '\n';
}

export function buildExportFilename(childName: string, at: Date = new Date()): string {
  const slug = childName
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeSlug = slug.length > 0 ? slug : 'child';
  const yyyy = at.getUTCFullYear();
  const mm = String(at.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(at.getUTCDate()).padStart(2, '0');
  return `tonguetutor-${safeSlug}-${yyyy}${mm}${dd}.csv`;
}

export async function fetchExportRows(childId: string): Promise<ExposureRow[]> {
  const results = await db
    .select({
      occurredAt: schema.exposures.occurredAt,
      foodName: schema.foods.name,
      category: schema.foods.category,
      stage: schema.exposures.stage,
      rating: schema.exposures.rating,
      preparation: schema.exposures.preparation,
      texture: schema.exposures.texture,
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
