import * as Crypto from 'expo-crypto';

// Randomness comes from expo-crypto, not `uuid` or Math.random. `uuid` reads a
// global `crypto.getRandomValues`, which Hermes does not provide, so on device
// every insert threw before reaching SQLite; Math.random is not a CSPRNG.
export function generateId(): string {
  return Crypto.randomUUID();
}

export const INVITE_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(): string {
  // The charset has 32 entries, which divides 256, so `byte % 32` is unbiased.
  const bytes = Crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARSET.charAt(bytes[i] % INVITE_CODE_CHARSET.length);
  }
  return code;
}

export function isValidInviteCode(code: string | null | undefined): boolean {
  if (typeof code !== 'string') return false;
  if (code.length !== INVITE_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!INVITE_CODE_CHARSET.includes(ch)) return false;
  }
  return true;
}

export function formatDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const startOfToday = getStartOfDay(new Date()).getTime();
  const startOfDate = getStartOfDay(date).getTime();
  const days = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

export function getStartOfDay(date: Date = new Date()): Date {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const d = new Date(safeDate);
  d.setHours(0, 0, 0, 0);
  return d;
}

// RFC 5321 § 4.5.3.1.1 caps the email local-part at 64 octets. The cap is
// applied AFTER sanitization so a future caller passing a longer string
// (or a relaxation of the upstream displayName max) still produces an
// RFC-valid local-part rather than a chopped-off invalid char near the
// boundary.
const RFC_5321_LOCAL_PART_MAX = 64;

export function deriveLocalEmailPart(displayName: string): string {
  const safeName = typeof displayName === 'string' ? displayName : '';
  const sanitized = safeName
    .toLowerCase()
    .replace(/[^a-z0-9.+-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, RFC_5321_LOCAL_PART_MAX);
  return sanitized.length > 0 ? sanitized : 'user';
}

/**
 * How far back an exposure may be backdated. Exposures are logged after the
 * fact (a parent is feeding a toddler, not holding a phone), but a date older
 * than this is a typo — an off-by-100 or off-by-1000 year slip — not a memory.
 */
export const MAX_BACKDATE_YEARS = 2;

/**
 * Turn the Log form's optional `YYYY-MM-DD` field into the timestamp stored in
 * `exposures.occurred_at`.
 *
 * Blank, non-string, or unparseable input falls back to `now` — the pre-v0.5.164
 * behaviour, so an absent date is exactly "logged just now".
 *
 * The date is parsed at **local** midnight, not UTC. A UTC parse would place a
 * user west of Greenwich on the previous calendar day, so their backdated row
 * would land outside the day they named on every surface that buckets by
 * `getStartOfDay` — the dashboard's Today count and the relative-date label.
 *
 * A date naming today resolves to `now` rather than local midnight, so a row
 * logged today keeps its time of day and stays correctly ordered against the
 * others in the same day's history.
 */
export function resolveOccurredAt(value?: string | null, now: Date = new Date()): Date {
  const base = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  if (typeof value !== 'string') return base;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return base;

  const [year, month, day] = trimmed.split('-').map(Number);
  const local = new Date(year, month - 1, day);
  if (Number.isNaN(local.getTime())) return base;
  // Reject a calendar rollover ('2026-02-30' would silently become Mar 1).
  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day
  ) {
    return base;
  }

  const isToday =
    local.getFullYear() === base.getFullYear() &&
    local.getMonth() === base.getMonth() &&
    local.getDate() === base.getDate();
  return isToday ? base : local;
}

/**
 * Render a stored timestamp as the local `YYYY-MM-DD` string the backdate
 * fields accept. Reads the *local* getters, matching `resolveOccurredAt`,
 * which parses a named day at local midnight — a UTC formatting here would
 * seed the editor with the previous day for every user west of Greenwich and
 * with the next day's row for none of them, so round-tripping an untouched
 * date would silently move it. Returns '' for anything unparseable.
 */
export function toLocalDateInput(value?: Date | number | string | null): string {
  if (value === null || value === undefined) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A child's age in **whole months** at the instant `at`, or `null` when it
 * cannot be known: a blank, non-string, malformed or rollover date of birth, an
 * unparseable `at`, or an `at` that falls before the birth. Parsed at local
 * midnight and the current month is not counted until the day of the month is
 * reached — the same rules `formatChildAge` renders from, because it calls this.
 *
 * Unlike `formatChildAge` there is no fallback to "now" for a bad `at`: the CSV
 * export asks for the age at each exposure's own timestamp, and a corrupt
 * timestamp must yield a blank cell rather than today's age.
 */
export function ageInMonthsAt(
  dateOfBirth: string | null | undefined,
  at: Date | number,
): number | null {
  if (typeof dateOfBirth !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const born = new Date(year, month - 1, day);
  // Rejects calendar rollovers (2026-02-30 would silently become Mar 1), the
  // same round-trip guard `childSchema.dateOfBirth` uses.
  if (
    born.getFullYear() !== year ||
    born.getMonth() !== month - 1 ||
    born.getDate() !== day
  ) {
    return null;
  }

  const reference = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(reference.getTime())) return null;
  if (born.getTime() > reference.getTime()) return null;

  let months =
    (reference.getFullYear() - born.getFullYear()) * 12 +
    (reference.getMonth() - born.getMonth());
  // Do not count the current month until the day of the month is reached.
  if (reference.getDate() < born.getDate()) months -= 1;
  return months;
}

/**
 * Render a child's `dateOfBirth` as a human age, or `null` when there is
 * nothing trustworthy to show.
 *
 * `children.dateOfBirth` has been captured since v0.1.0 and read back by
 * nothing — the same write-only defect v0.5.161 closed for a food's
 * `defaultPreparation`. This is what gives it somewhere to be displayed,
 * which is the actual reason a parent typed it.
 *
 * Under two, the age is reported in **whole months**, which is the unit
 * feeding therapy actually works in for that range (a 9-month-old and an
 * 18-month-old are at completely different points of the hierarchy, and "1
 * year" flattens them together). Over two, years-and-months reads better.
 *
 * Returns `null` rather than a placeholder for blank, non-string, malformed
 * and future dates. `childSchema.dateOfBirth` rejects all of those at the add
 * path (format v0.5.79, future v0.5.87, implausibly-old v0.5.100), but the
 * SQLite column carries no format constraint, so a legacy or future-synced row
 * can still hold one — and a row that renders "-2 months old" is worse than a
 * row that renders nothing.
 *
 * Parsed at **local** midnight (`new Date(y, m - 1, d)`), matching
 * `resolveOccurredAt` and `toLocalDateInput`: a UTC parse would shift the
 * birthday a day for every user west of Greenwich, which flips the answer on
 * the day before a monthly boundary.
 */
export function formatChildAge(
  dateOfBirth: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const reference = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const months = ageInMonthsAt(dateOfBirth, reference);
  if (months === null) return null;

  if (months < 1) return 'Newborn';
  if (months < 24) return months === 1 ? '1 month' : `${months} months`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}y` : `${years}y ${rest}m`;
}
