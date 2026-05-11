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

export function isValidInviteCode(code: string): boolean {
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
  const sanitized = displayName
    .toLowerCase()
    .replace(/[^a-z0-9.+-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, RFC_5321_LOCAL_PART_MAX);
  return sanitized.length > 0 ? sanitized : 'user';
}
