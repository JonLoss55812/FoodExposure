import { v4 as uuidv4 } from 'uuid';

export function generateId(): string {
  return uuidv4();
}

export const INVITE_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_CHARSET.charAt(Math.floor(Math.random() * INVITE_CODE_CHARSET.length));
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
