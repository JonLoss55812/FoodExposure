import { formatExposuresCsv, csvEscape, buildExportFilename } from '../export';
import type { ExposureRow } from '../export';

const iso = (s: string) => new Date(s);

const row = (over: Partial<ExposureRow> = {}): ExposureRow => ({
  occurredAt: iso('2026-04-01T13:30:00.000Z'),
  foodName: 'Apple',
  category: 'fruit',
  isSafeFood: false,
  stage: 'taste',
  rating: 4,
  preparation: 'sliced',
  texture: 'crunchy',
  temperature: 'cold',
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

  // CSV injection defense (OWASP CWE-1236): a therapist opening the export
  // in Excel/Sheets must not have notes starting with =/+/-/@/tab/CR
  // evaluated as formulas. The guard prefixes such strings with a single
  // quote inside the quoted field.
  describe('formula injection guard', () => {
    it('prefixes leading = with a single quote inside quotes', () => {
      expect(csvEscape('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
    });

    it('prefixes leading + with a single quote', () => {
      expect(csvEscape('+1234567890')).toBe(`"'+1234567890"`);
    });

    it('prefixes leading - with a single quote', () => {
      expect(csvEscape('-cmd|/c calc')).toBe(`"'-cmd|/c calc"`);
    });

    it('prefixes leading @ with a single quote', () => {
      expect(csvEscape('@SUM(1,2)')).toBe(`"'@SUM(1,2)"`);
    });

    it('prefixes leading tab with a single quote', () => {
      expect(csvEscape('\t=evil')).toBe(`"'\t=evil"`);
    });

    it('prefixes leading CR with a single quote', () => {
      expect(csvEscape('\r=evil')).toBe(`"'\r=evil"`);
    });

    it('does not prefix when trigger char appears later in the value', () => {
      expect(csvEscape('total = 5')).toBe('total = 5');
    });

    it('escapes embedded quotes after applying formula prefix', () => {
      expect(csvEscape('=said "no"')).toBe(`"'=said ""no"""`);
    });

    it('does not prefix numbers that stringify with leading minus', () => {
      // numeric values are coerced via String(); formula-trigger logic
      // only fires on string inputs (rating/numeric columns are bounded
      // by schema, so this is a future-proofing guarantee, not a real case).
      expect(csvEscape(-5)).toBe('-5');
    });
  });
});

describe('formatExposuresCsv', () => {
  const header = 'date,food,category,safe_food,stage,rating,preparation,texture,temperature,meal,setting,notes';

  it('returns header only when rows are empty', () => {
    expect(formatExposuresCsv([])).toBe('\uFEFF' + header + '\n');
  });

  // Excel on Windows defaults to ANSI/Windows-1252 unless a UTF-8 BOM
  // (\uFEFF) hints otherwise. A parent who logged "Crème brûlée" or
  // "café" would see mangled chars when their feeding therapist opens
  // the export in Excel. Prepending the BOM is the canonical one-byte
  // fix per https://stackoverflow.com/q/6002256.
  it('starts with a UTF-8 BOM so Excel auto-detects UTF-8', () => {
    const csv = formatExposuresCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('preserves non-ASCII food names verbatim after the BOM', () => {
    const csv = formatExposuresCsv([row({ foodName: 'Crème brûlée' })]);
    // BOM precedes the header; the header precedes the body line.
    expect(csv.startsWith('\uFEFF' + header)).toBe(true);
    // Round-trip the food name through to make sure encoding is intact.
    expect(csv).toContain('Crème brûlée');
  });

  it('serializes a simple row with ISO date', () => {
    const csv = formatExposuresCsv([row()]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe(header);
    expect(lines[1]).toBe(
      '2026-04-01T13:30:00.000Z,Apple,fruit,false,taste,4,sliced,crunchy,cold,snack,home,'
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
      row({ rating: null, preparation: null, texture: null, temperature: null, mealType: null, setting: null, notes: null }),
    ]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols).toHaveLength(12);
    expect(cols[5]).toBe(''); // rating
    expect(cols[8]).toBe(''); // temperature
    expect(cols[11]).toBe(''); // notes
  });

  it('serializes temperature alongside texture for sensory dimension parity', () => {
    const csv = formatExposuresCsv([row({ temperature: 'hot', texture: 'soft' })]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[7]).toBe('soft');
    expect(cols[8]).toBe('hot');
  });

  it('serializes isSafeFood as a boolean string adjacent to category', () => {
    const csv = formatExposuresCsv([row({ isSafeFood: true })]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[2]).toBe('fruit');
    expect(cols[3]).toBe('true');
  });

  it('serializes isSafeFood=false as the literal string "false"', () => {
    const csv = formatExposuresCsv([row({ isSafeFood: false })]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[3]).toBe('false');
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

  // Defensive: a single corrupted occurredAt cell must not throw and abort
  // the entire export. A therapist needs the rest of the data more than
  // they need the one bad timestamp.
  it('emits an empty date column when occurredAt is an invalid Date', () => {
    const bad = new Date('not-a-real-date');
    const csv = formatExposuresCsv([row({ occurredAt: bad })]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[0]).toBe('');
    expect(cols[1]).toBe('Apple');
  });

  it('emits an empty date column when occurredAt is NaN', () => {
    const csv = formatExposuresCsv([row({ occurredAt: NaN as unknown as Date })]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[0]).toBe('');
  });

  it('emits an empty date column when occurredAt is an unparseable string', () => {
    const csv = formatExposuresCsv([
      row({ occurredAt: 'totally bogus' as unknown as Date }),
    ]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[0]).toBe('');
  });

  it('continues exporting subsequent rows when one row has a bad date', () => {
    const csv = formatExposuresCsv([
      row({ occurredAt: new Date('invalid'), foodName: 'BadDateApple' }),
      row({ foodName: 'GoodPear' }),
    ]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith(',BadDateApple,')).toBe(true);
    expect(lines[2]).toContain('2026-04-01T13:30:00.000Z');
    expect(lines[2]).toContain('GoodPear');
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

  // Defensive: a corrupt Date instance (`new Date('invalid')`) would
  // otherwise produce `tonguetutor-emma-NaNNaNNaN.csv` — semantically
  // broken filename that's unsearchable in Files app and won't sort
  // chronologically alongside other valid exports. Same drift class as
  // v0.5.96 (CSV occurredAt guard), v0.5.98 (formatRelativeDate guard),
  // v0.5.102 (formatDate guard).
  it('falls back to current date when given an invalid Date', () => {
    const before = Date.now();
    const name = buildExportFilename('Emma', new Date('not-a-real-date'));
    const after = Date.now();
    // Should NOT contain the literal "NaN" anywhere.
    expect(name).not.toContain('NaN');
    // Should match the YYYYMMDD pattern (uses current date as fallback).
    expect(name).toMatch(/^tonguetutor-emma-\d{8}\.csv$/);
    // Sanity-check the digits represent a real date in the [before, after] window.
    const match = name.match(/(\d{4})(\d{2})(\d{2})/);
    expect(match).not.toBeNull();
    const [, yyyy, mm, dd] = match!;
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    // Window check: the fallback was taken within the test span.
    const beforeUtc = new Date(before);
    const afterUtc = new Date(after);
    const beforeYmd = `${beforeUtc.getUTCFullYear()}${String(beforeUtc.getUTCMonth() + 1).padStart(2, '0')}${String(beforeUtc.getUTCDate()).padStart(2, '0')}`;
    const afterYmd = `${afterUtc.getUTCFullYear()}${String(afterUtc.getUTCMonth() + 1).padStart(2, '0')}${String(afterUtc.getUTCDate()).padStart(2, '0')}`;
    const filenameYmd = `${yyyy}${mm}${dd}`;
    expect(filenameYmd >= beforeYmd && filenameYmd <= afterYmd).toBe(true);
  });

  it('passes through a valid Date unchanged (regression lock for the happy path)', () => {
    const name = buildExportFilename('Emma', iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-emma-20260510.csv');
  });

  // childSchema caps name at 50 chars on insert, but SQLite has no
  // DB-level length constraint — a corrupted row (Convex sync drift,
  // hand-edited dev DB, CSV import) carrying a 200-char name would
  // otherwise produce a 200-char filename that may overflow 255-byte
  // filesystem limits or trip share-sheet preview truncation. Cap is
  // applied AFTER sanitize so the slug is provably valid by construction.
  it('caps slug at 50 chars when given a long childName', () => {
    const longName = 'a'.repeat(200);
    const name = buildExportFilename(longName, iso('2026-05-10T00:00:00.000Z'));
    // tonguetutor-<50 chars>-20260510.csv
    expect(name).toBe(`tonguetutor-${'a'.repeat(50)}-20260510.csv`);
  });

  it('truncates mid-word when slice falls within an alphanumeric run', () => {
    // 'a'*48 + ' suffix' (55 chars) → sanitized to 'aaaa…aaaa-suffix'
    // → sliced to 50 chars → 'aaaa…aaaa-s' (48 a's + '-' + 's').
    // Trailing 's' is not a hyphen so the sweep is a no-op here.
    const name = buildExportFilename('a'.repeat(48) + ' suffix', iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe(`tonguetutor-${'a'.repeat(48)}-s-20260510.csv`);
  });

  it('does not produce a trailing hyphen when slice ends exactly at hyphen boundary', () => {
    // 'a'*49 + ' ' + 'b' → 'aaaa…aaaa-b' (51 chars). Slice(0,50) leaves
    // 'aaaa…aaaa-' (50 chars ending in hyphen). The trailing-hyphen sweep
    // strips it so the filename never has a dangling -.
    const name = buildExportFilename('a'.repeat(49) + ' b', iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe(`tonguetutor-${'a'.repeat(49)}-20260510.csv`);
    expect(name).not.toContain('--');
  });

  it('preserves names at exactly the cap (boundary)', () => {
    const name = buildExportFilename('a'.repeat(50), iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe(`tonguetutor-${'a'.repeat(50)}-20260510.csv`);
  });
});
