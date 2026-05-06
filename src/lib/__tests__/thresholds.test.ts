import {
  EXPOSURE_THRESHOLDS,
  FEEDING_PROFILES,
  FEEDING_PROFILE_CONFIG,
  getThresholdForProfile,
  calcExposureProgress,
  type FeedingProfile,
} from '../thresholds';

describe('EXPOSURE_THRESHOLDS', () => {
  it('defines thresholds for typical/picky/arfid grounded in SOS research', () => {
    expect(EXPOSURE_THRESHOLDS.typical).toBe(15);
    expect(EXPOSURE_THRESHOLDS.picky).toBe(20);
    expect(EXPOSURE_THRESHOLDS.arfid).toBe(30);
  });

  it('FEEDING_PROFILES lists the three valid profile keys', () => {
    expect(FEEDING_PROFILES).toEqual(['typical', 'picky', 'arfid']);
  });
});

describe('getThresholdForProfile', () => {
  it('returns correct count per profile', () => {
    expect(getThresholdForProfile('typical')).toBe(15);
    expect(getThresholdForProfile('picky')).toBe(20);
    expect(getThresholdForProfile('arfid')).toBe(30);
  });
});

describe('calcExposureProgress', () => {
  it('returns 0% when no exposures', () => {
    expect(calcExposureProgress(0, 'typical')).toEqual({
      current: 0,
      threshold: 15,
      pct: 0,
      reached: false,
    });
  });

  it('returns 7/15 ~47% for 7 exposures under typical profile', () => {
    const result = calcExposureProgress(7, 'typical');
    expect(result.current).toBe(7);
    expect(result.threshold).toBe(15);
    expect(result.pct).toBeCloseTo(0.47, 2);
    expect(result.reached).toBe(false);
  });

  it('clamps pct at 1.0 when current exceeds threshold but records reached', () => {
    const result = calcExposureProgress(20, 'typical');
    expect(result.current).toBe(20);
    expect(result.threshold).toBe(15);
    expect(result.pct).toBe(1);
    expect(result.reached).toBe(true);
  });

  it('marks reached=true at exactly threshold', () => {
    const result = calcExposureProgress(15, 'typical');
    expect(result.pct).toBe(1);
    expect(result.reached).toBe(true);
  });

  it('uses picky profile threshold of 20', () => {
    const result = calcExposureProgress(10, 'picky');
    expect(result.threshold).toBe(20);
    expect(result.pct).toBe(0.5);
    expect(result.reached).toBe(false);
  });

  it('uses arfid profile threshold of 30', () => {
    const result = calcExposureProgress(15, 'arfid');
    expect(result.threshold).toBe(30);
    expect(result.pct).toBe(0.5);
    expect(result.reached).toBe(false);
  });

  it('treats negative exposure counts as 0 defensively', () => {
    const result = calcExposureProgress(-3 as number, 'typical');
    expect(result.current).toBe(0);
    expect(result.pct).toBe(0);
    expect(result.reached).toBe(false);
  });

  it('accepts FeedingProfile type safely', () => {
    const profile: FeedingProfile = 'typical';
    expect(getThresholdForProfile(profile)).toBe(15);
  });
});

describe('cross-record alignment', () => {
  it('every FEEDING_PROFILES key has an EXPOSURE_THRESHOLDS entry', () => {
    const thresholdKeys = Object.keys(EXPOSURE_THRESHOLDS).sort();
    expect(thresholdKeys).toEqual([...FEEDING_PROFILES].sort());
  });

  it('every FEEDING_PROFILES key has a FEEDING_PROFILE_CONFIG entry with label and description', () => {
    const configKeys = Object.keys(FEEDING_PROFILE_CONFIG).sort();
    expect(configKeys).toEqual([...FEEDING_PROFILES].sort());
    for (const profile of FEEDING_PROFILES) {
      expect(typeof FEEDING_PROFILE_CONFIG[profile].label).toBe('string');
      expect(FEEDING_PROFILE_CONFIG[profile].label.length).toBeGreaterThan(0);
      expect(typeof FEEDING_PROFILE_CONFIG[profile].description).toBe('string');
      expect(FEEDING_PROFILE_CONFIG[profile].description.length).toBeGreaterThan(0);
    }
  });

  it('FEEDING_PROFILE_CONFIG.description copy includes the threshold value for each profile', () => {
    for (const profile of FEEDING_PROFILES) {
      const threshold = EXPOSURE_THRESHOLDS[profile];
      const description = FEEDING_PROFILE_CONFIG[profile].description;
      expect(description).toContain(String(threshold));
    }
  });
});
