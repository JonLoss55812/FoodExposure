import { getNextStage, canBumpStage } from '../stage';

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
