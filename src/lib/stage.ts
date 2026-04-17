import { STAGE_ORDER, type ExposureStage } from './constants';

export function getNextStage(current: ExposureStage | null): ExposureStage | null {
  if (current === null) return STAGE_ORDER[0];
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function canBumpStage(current: ExposureStage | null): boolean {
  return getNextStage(current) !== null;
}
