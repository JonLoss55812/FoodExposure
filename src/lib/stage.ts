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

export function getHighestStage(
  exposures: readonly { stage: string }[],
): ExposureStage | null {
  let highest: ExposureStage | null = null;
  for (const exp of exposures) {
    const stage = exp.stage as ExposureStage;
    if (STAGE_ORDER.indexOf(stage) < 0) continue;
    if (!highest || STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(highest)) {
      highest = stage;
    }
  }
  return highest;
}
