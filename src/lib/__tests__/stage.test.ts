import { getNextStage, canBumpStage, getHighestStage } from '../stage';

describe('getNextStage', () => {
  it('returns first stage (tolerate) when current is null', () => {
    expect(getNextStage(null)).toBe('tolerate');
  });

  it('advances one step through the hierarchy', () => {
    expect(getNextStage('tolerate')).toBe('interact');
    expect(getNextStage('interact')).toBe('smell');
    expect(getNextStage('smell')).toBe('touch');
    expect(getNextStage('touch')).toBe('taste');
    expect(getNextStage('taste')).toBe('eat');
  });

  it('returns null at terminal stage (eat)', () => {
    expect(getNextStage('eat')).toBeNull();
  });

  it('returns first stage (tolerate) when current is undefined', () => {
    expect(getNextStage(undefined)).toBe('tolerate');
  });

  it('returns null for unknown stage strings', () => {
    expect(getNextStage('mystery' as string)).toBeNull();
    expect(getNextStage('TOLERATE' as string)).toBeNull();
    expect(getNextStage('' as string)).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(getNextStage(42 as unknown as string)).toBeNull();
    expect(getNextStage({} as unknown as string)).toBeNull();
    expect(getNextStage([] as unknown as string)).toBeNull();
  });
});

describe('canBumpStage', () => {
  it('returns true when current stage is null (can start at tolerate)', () => {
    expect(canBumpStage(null)).toBe(true);
  });

  it('returns true for every stage except eat', () => {
    expect(canBumpStage('tolerate')).toBe(true);
    expect(canBumpStage('interact')).toBe(true);
    expect(canBumpStage('smell')).toBe(true);
    expect(canBumpStage('touch')).toBe(true);
    expect(canBumpStage('taste')).toBe(true);
  });

  it('returns false at terminal stage (eat)', () => {
    expect(canBumpStage('eat')).toBe(false);
  });

  it('returns true when current stage is undefined (can start at tolerate)', () => {
    expect(canBumpStage(undefined)).toBe(true);
  });

  it('returns false for unknown stage strings', () => {
    expect(canBumpStage('mystery' as string)).toBe(false);
    expect(canBumpStage('TOLERATE' as string)).toBe(false);
    expect(canBumpStage('' as string)).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(canBumpStage(42 as unknown as string)).toBe(false);
    expect(canBumpStage({} as unknown as string)).toBe(false);
  });
});

describe('getHighestStage', () => {
  it('returns null for an empty list', () => {
    expect(getHighestStage([])).toBeNull();
  });

  it('returns the only stage when one exposure exists', () => {
    expect(getHighestStage([{ stage: 'smell' }])).toBe('smell');
  });

  it('returns the highest stage among many', () => {
    expect(
      getHighestStage([
        { stage: 'tolerate' },
        { stage: 'taste' },
        { stage: 'smell' },
        { stage: 'interact' },
      ]),
    ).toBe('taste');
  });

  it('returns eat when present (terminal stage wins)', () => {
    expect(getHighestStage([{ stage: 'eat' }, { stage: 'tolerate' }])).toBe('eat');
  });

  it('ignores unknown stages', () => {
    expect(getHighestStage([{ stage: 'bogus' }, { stage: 'touch' }])).toBe('touch');
  });

  it('returns null when only unknown stages are present', () => {
    expect(getHighestStage([{ stage: 'bogus' }, { stage: 'fake' }])).toBeNull();
  });
});
