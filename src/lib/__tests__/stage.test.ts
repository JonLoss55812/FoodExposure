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
