import { v4 as uuidv4 } from 'uuid';
import { STAGE_ORDER, type ExposureStage } from './constants';

export function generateId(): string {
  return uuidv4();
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getStageIndex(stage: ExposureStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function isStageHigher(a: ExposureStage, b: ExposureStage): boolean {
  return getStageIndex(a) > getStageIndex(b);
}

export function getExposureProgress(count: number, target: number = 15): number {
  return Math.min(count / target, 1);
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

export function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
