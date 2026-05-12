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
  exposures: readonly { stage: ExposureStage | string | null | undefined }[],
): ExposureStage | null {
  let highest: ExposureStage | null = null;
  let highestIdx = -1;
  for (const exp of exposures) {
    const stage = exp.stage;
    if (typeof stage !== 'string') continue;
    if (!(STAGE_ORDER as readonly string[]).includes(stage)) continue;
    const idx = STAGE_ORDER.indexOf(stage as ExposureStage);
    if (idx > highestIdx) {
      highest = stage as ExposureStage;
      highestIdx = idx;
    }
  }
  return highest;
}
