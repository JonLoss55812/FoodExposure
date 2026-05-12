import { STAGE_ORDER, type ExposureStage } from './constants';

export function getNextStage(
  current: ExposureStage | string | null | undefined,
): ExposureStage | null {
  if (current === null || current === undefined) return STAGE_ORDER[0];
  if (typeof current !== 'string') return null;
  if (!(STAGE_ORDER as readonly string[]).includes(current)) return null;
  const idx = STAGE_ORDER.indexOf(current as ExposureStage);
  if (idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

export function canBumpStage(
  current: ExposureStage | string | null | undefined,
): boolean {
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
