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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatRelativeDate(date: Date): string {
  const startOfToday = getStartOfDay(new Date()).getTime();
  const startOfDate = getStartOfDay(date).getTime();
  const days = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(date);
}

export function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function deriveLocalEmailPart(displayName: string): string {
  const sanitized = displayName
    .toLowerCase()
    .replace(/[^a-z0-9.+-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return sanitized.length > 0 ? sanitized : 'user';
}
