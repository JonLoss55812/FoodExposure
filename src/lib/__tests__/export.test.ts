import { formatExposuresCsv, csvEscape, buildExportFilename } from '../export';
import type { ExposureRow } from '../export';

const iso = (s: string) => new Date(s);

const row = (over: Partial<ExposureRow> = {}): ExposureRow => ({
  occurredAt: iso('2026-04-01T13:30:00.000Z'),
  foodName: 'Apple',
  category: 'fruit',
  stage: 'taste',
  rating: 4,
  preparation: 'sliced',
  texture: 'crunchy',
  mealType: 'snack',
  setting: 'home',
  notes: '',
  ...over,
});

describe('csvEscape', () => {
  it('returns empty string for null/undefined', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('leaves plain strings untouched', () => {
    expect(csvEscape('hello')).toBe('hello');
  });

  it('quote-wraps and doubles quotes when value contains a comma', () => {
    expect(csvEscape('he said, yes')).toBe('"he said, yes"');
  });

  it('quote-wraps and escapes embedded double quotes', () => {
    expect(csvEscape('she said "no"')).toBe('"she said ""no"""');
  });

  it('quote-wraps newlines', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('stringifies numbers', () => {
    expect(csvEscape(5)).toBe('5');
    expect(csvEscape(0)).toBe('0');
  });
});

describe('formatExposuresCsv', () => {
  const header = 'date,food,category,stage,rating,preparation,texture,meal,setting,notes';

  it('returns header only when rows are empty', () => {
    expect(formatExposuresCsv([])).toBe(header + '\n');
  });

  it('serializes a simple row with ISO date', () => {
    const csv = formatExposuresCsv([row()]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(header);
    expect(lines[1]).toBe(
      '2026-04-01T13:30:00.000Z,Apple,fruit,taste,4,sliced,crunchy,snack,home,'
    );
  });

  it('quote-escapes notes containing commas', () => {
    const csv = formatExposuresCsv([row({ notes: 'ate half, spit rest' })]);
    expect(csv).toContain('"ate half, spit rest"');
  });

  it('escapes embedded double quotes in notes', () => {
    const csv = formatExposuresCsv([row({ notes: 'said "yuck"' })]);
    expect(csv).toContain('"said ""yuck"""');
  });

  it('leaves optional fields empty without an extra comma', () => {
    const csv = formatExposuresCsv([
      row({ rating: null, preparation: null, texture: null, mealType: null, setting: null, notes: null }),
    ]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols).toHaveLength(10);
    expect(cols[4]).toBe(''); // rating
    expect(cols[9]).toBe(''); // notes
  });

  it('emits one line per row plus header', () => {
    const csv = formatExposuresCsv([row(), row({ foodName: 'Pear' })]);
    expect(csv.trim().split('\n')).toHaveLength(3);
  });

  it('renders occurredAt as ISO 8601 even when given a timestamp number', () => {
    const ts = iso('2026-03-15T08:00:00.000Z').getTime();
    const csv = formatExposuresCsv([row({ occurredAt: ts as unknown as Date })]);
    expect(csv).toContain('2026-03-15T08:00:00.000Z');
  });
});

describe('buildExportFilename', () => {
  it('lowercases and hyphenates child name with YYYYMMDD suffix', () => {
    const name = buildExportFilename('Ada Lovelace', iso('2026-04-18T09:00:00.000Z'));
    expect(name).toBe('tonguetutor-ada-lovelace-20260418.csv');
  });

  it('strips punctuation and collapses whitespace', () => {
    const name = buildExportFilename("Miles O'Brien, Jr.", iso('2026-01-02T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-miles-obrien-jr-20260102.csv');
  });

  it('falls back to "child" for empty names', () => {
    const name = buildExportFilename('   ', iso('2026-07-04T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-child-20260704.csv');
  });
});
