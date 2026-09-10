import {
  formatExposuresCsv,
  csvEscape,
  buildExportFilename,
  toLocalIsoString,
} from '../export';
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

  // Non-finite number guard: same drift class as v0.5.106 (rating
  // accumulation) and v0.5.120 (toIsoDate null guard). A corrupt
  // rating: NaN row that bypassed the schema's int/min/max validation
  // would otherwise emit the literal text "NaN" into the
  // therapist-facing CSV — a value indistinguishable from a real rating
  // at a glance but poisoning every downstream sort/filter/avg.
  describe('non-finite number guard', () => {
    it('returns empty string for NaN', () => {
      expect(csvEscape(NaN)).toBe('');
    });

    it('returns empty string for Infinity', () => {
      expect(csvEscape(Infinity)).toBe('');
    });

    it('returns empty string for -Infinity', () => {
      expect(csvEscape(-Infinity)).toBe('');
    });

    it('still emits finite numbers (regression lock)', () => {
      // Pins the happy path so a contributor "simplifying" the guard
      // (e.g. dropping the typeof check) would fail loudly on 0/-1.
      expect(csvEscape(0)).toBe('0');
      expect(csvEscape(-1)).toBe('-1');
      expect(csvEscape(3.14)).toBe('3.14');
    });
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
    // The date column renders in the *device's* local zone (see
    // toLocalIsoString), so it is asserted separately, by shape, rather
    // than pinned to a host-timezone-specific literal that would fail on
    // any other machine. The exact rendering is covered by the
    // toLocalIsoString block below, which injects a fixed offset.
    const cols1 = lines[1].split(',');
    expect(cols1[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(cols1.slice(1).join(',')).toBe(
      'Apple,fruit,false,taste,4,sliced,crunchy,cold,snack,home,'
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
    expect(csv.trim().split('\n')[1].split(',')[0]).toBe(
      toLocalIsoString(iso('2026-03-15T08:00:00.000Z'))
    );
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

  // v0.5.120: `new Date(null)` coerces null to 0 and returns the Unix
  // epoch (1970-01-01T00:00:00.000Z), whose .getTime() is 0 (NOT NaN) —
  // so the existing Number.isNaN guard would let it through and emit
  // the epoch as the date column on a corrupt occurredAt=null row. A
  // therapist reading the export would see exposures dated 1970, a
  // clinically nonsensical date. The fix early-returns on null before
  // the Date constructor runs.
  it('emits an empty date column when occurredAt is null (regression: epoch coercion)', () => {
    const csv = formatExposuresCsv([row({ occurredAt: null as unknown as Date })]);
    const cols = csv.trim().split('\n')[1].split(',');
    expect(cols[0]).toBe('');
    // Defensive: must NOT emit the Unix epoch, which is what
    // `new Date(null).toISOString()` would produce.
    expect(cols[0]).not.toBe('1970-01-01T00:00:00.000Z');
  });

  it('emits an empty date column when occurredAt is undefined', () => {
    const csv = formatExposuresCsv([row({ occurredAt: undefined as unknown as Date })]);
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
    expect(lines[2]).toContain(toLocalIsoString(iso('2026-04-01T13:30:00.000Z')));
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

  // Defensive: childSchema enforces `name: trim().min(1).max(50)` at insert
  // (`src/lib/validation.ts:15`), but SQLite has no DB-level type constraint
  // on the `children.name` column. A corrupted row (future Convex sync drift,
  // hand-edited dev DB, CSV import that bypasses the schema) carrying a
  // non-string value would otherwise crash the export at `childName.toLowerCase()`
  // with a TypeError — taking down the entire Settings → Export Data flow.
  // Same defense-in-depth class as v0.5.111 (deriveLocalEmailPart cap) and
  // v0.5.113 (slug length cap): every present and future caller of
  // buildExportFilename is provably safe regardless of input type.
  it('falls back to "child" when childName is null', () => {
    const name = buildExportFilename(null as unknown as string, iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-child-20260510.csv');
  });

  it('falls back to "child" when childName is undefined', () => {
    const name = buildExportFilename(undefined as unknown as string, iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-child-20260510.csv');
  });

  it('falls back to "child" when childName is a number', () => {
    const name = buildExportFilename(42 as unknown as string, iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-child-20260510.csv');
  });

  it('falls back to "child" when childName is an object', () => {
    const name = buildExportFilename({} as unknown as string, iso('2026-05-10T00:00:00.000Z'));
    expect(name).toBe('tonguetutor-child-20260510.csv');
  });
});


// The date column names a *calendar day* to the feeding therapist reading the
// export. Every other date surface in the app buckets by the LOCAL calendar
// day (`getStartOfDay` -> setHours(0,0,0,0); `formatRelativeDate` -> local day
// deltas; the v0.5.164 `resolveOccurredAt` -> local midnight). Rendering the
// export in UTC put this one column out of step with all of them.
//
// The offset is injected rather than driven through `process.env.TZ` because
// jest's jsdom environment resolves the host timezone once and ignores later
// writes to it (measured — a TZ set inside a test leaves getTimezoneOffset()
// reporting the host zone). Injection also makes the sign/padding/rollover
// arithmetic — which is where the actual bugs live — directly assertable.
describe('toLocalIsoString', () => {
  const SYDNEY = 600; // UTC+10
  const CHICAGO = -300; // UTC-5
  const KOLKATA = 330; // UTC+05:30

  // The load-bearing case. 22:00Z on the 9th is 08:00 on the 10th in Sydney —
  // the app shows this row on the 10th on every surface, so the export must
  // too. The pre-fix implementation emitted '2026-09-09T22:00:00.000Z'.
  it('names the LOCAL calendar day when the local day is ahead of UTC', () => {
    const out = toLocalIsoString(iso('2026-09-09T22:00:00.000Z'), SYDNEY);
    expect(out).toBe('2026-09-10T08:00:00.000+10:00');
    expect(out.startsWith('2026-09-09')).toBe(false);
  });

  // The mirror case: 01:00Z on the 10th is 20:00 on the 9th in Chicago.
  it('names the LOCAL calendar day when the local day is behind UTC', () => {
    const out = toLocalIsoString(iso('2026-09-10T01:00:00.000Z'), CHICAGO);
    expect(out).toBe('2026-09-09T20:00:00.000-05:00');
    expect(out.startsWith('2026-09-10')).toBe(false);
  });

  // A v0.5.164 backdated exposure is stored at LOCAL midnight of the day the
  // parent named. Under the old UTC render every UTC+ user's backdated row
  // came out one day early — the most damaging instance of this bug, because
  // backdating exists specifically to make this column correct.
  it('round-trips a backdated local-midnight exposure to the day the parent named', () => {
    // Local midnight on 2026-09-05 in Sydney is 2026-09-04T14:00:00Z.
    const stored = iso('2026-09-04T14:00:00.000Z');
    expect(toLocalIsoString(stored, SYDNEY)).toBe('2026-09-05T00:00:00.000+10:00');
  });

  // Not every offset is a whole hour. An implementation that divided by 60 and
  // dropped the remainder would emit '+05:00' and silently misstate the zone.
  it('renders a half-hour offset with its minutes', () => {
    expect(toLocalIsoString(iso('2026-09-09T20:00:00.000Z'), KOLKATA)).toBe(
      '2026-09-10T01:30:00.000+05:30'
    );
  });

  // Sign lock. getTimezoneOffset() reports minutes *behind* UTC (UTC+10 is
  // -600), so a missing negation in the default path flips every offset in
  // the file — and would also shift the wall clock 20 hours the wrong way.
  it('treats the offset as minutes ahead of UTC, the ISO 8601 convention', () => {
    expect(toLocalIsoString(iso('2026-09-10T00:00:00.000Z'), 600)).toBe(
      '2026-09-10T10:00:00.000+10:00'
    );
    expect(toLocalIsoString(iso('2026-09-10T00:00:00.000Z'), -600)).toBe(
      '2026-09-09T14:00:00.000-10:00'
    );
  });

  it('zero-pads every component', () => {
    expect(toLocalIsoString(iso('2026-01-02T03:04:05.006Z'), 0)).toBe(
      '2026-01-02T03:04:05.006+00:00'
    );
  });

  // Defaulting to the device offset is what the CSV path relies on. Assert it
  // agrees with the platform's own local getters rather than re-deriving the
  // format, so this stays a real check and not a restatement of the function.
  it('defaults to the device offset when none is given', () => {
    const d = iso('2026-04-01T13:30:00.000Z');
    const out = toLocalIsoString(d);
    expect(out.slice(0, 10)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`
    );
    expect(out.slice(11, 19)).toBe(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
        2,
        '0'
      )}:${String(d.getSeconds()).padStart(2, '0')}`
    );
  });

  // A non-finite injected offset must fall back to the device rather than
  // producing 'NaN-NaN-NaNTNaN:NaN' in a therapist's spreadsheet.
  it('falls back to the device offset for a non-finite offset', () => {
    const d = iso('2026-04-01T13:30:00.000Z');
    expect(toLocalIsoString(d, NaN)).toBe(toLocalIsoString(d));
    expect(toLocalIsoString(d, Infinity)).toBe(toLocalIsoString(d));
  });

  // The v0.5.120 / v0.5.96 corrupt-row guards must survive the refactor.
  it('keeps the empty-string guards for null, undefined and unparseable input', () => {
    expect(toLocalIsoString(null as unknown as Date, SYDNEY)).toBe('');
    expect(toLocalIsoString(undefined as unknown as Date, SYDNEY)).toBe('');
    expect(toLocalIsoString(new Date('nope'), SYDNEY)).toBe('');
    expect(toLocalIsoString('totally bogus', SYDNEY)).toBe('');
  });
});
