export const FEEDING_PROFILES = ['typical', 'picky', 'arfid'] as const;
export type FeedingProfile = typeof FEEDING_PROFILES[number];

export const EXPOSURE_THRESHOLDS: Record<FeedingProfile, number> = {
  typical: 15,
  picky: 20,
  arfid: 30,
};

export const FEEDING_PROFILE_CONFIG: Record<
  FeedingProfile,
  { label: string; description: string }
> = {
  typical: { label: 'Typical', description: '8–15 exposures to acceptance' },
  picky: { label: 'Picky', description: '15–20 exposures to acceptance' },
  arfid: { label: 'ARFID', description: '20–30+ exposures to acceptance' },
};

const DEFAULT_PROFILE: FeedingProfile = 'typical';

function isValidProfile(value: unknown): value is FeedingProfile {
  return typeof value === 'string' && (FEEDING_PROFILES as readonly string[]).includes(value);
}

export function getThresholdForProfile(profile: FeedingProfile): number {
  return EXPOSURE_THRESHOLDS[isValidProfile(profile) ? profile : DEFAULT_PROFILE];
}

export function getFeedingProfileConfig(profile: unknown) {
  return FEEDING_PROFILE_CONFIG[isValidProfile(profile) ? profile : DEFAULT_PROFILE];
}

export interface ExposureProgress {
  current: number;
  threshold: number;
  pct: number;
  reached: boolean;
}

export function calcExposureProgress(
  exposureCount: number,
  profile: FeedingProfile
): ExposureProgress {
  const safeCount = Number.isFinite(exposureCount) ? Math.floor(exposureCount) : 0;
  const current = Math.max(0, safeCount);
  const threshold = getThresholdForProfile(profile);
  const rawPct = current / threshold;
  const pct = Math.min(1, rawPct);
  return {
    current,
    threshold,
    pct,
    reached: current >= threshold,
  };
}
