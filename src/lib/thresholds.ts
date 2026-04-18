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

export function getThresholdForProfile(profile: FeedingProfile): number {
  return EXPOSURE_THRESHOLDS[profile];
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
  const current = Math.max(0, exposureCount);
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
