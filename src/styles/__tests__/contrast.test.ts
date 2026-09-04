import { darkTheme, lightTheme } from '../theme';

/**
 * WCAG 2.1 relative luminance / contrast ratio.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// AA for body text (< 18.66px bold / 24px regular).
const AA_NORMAL = 4.5;

describe('theme contrast (WCAG 2.1 AA)', () => {
  it('computes known contrast ratios correctly', () => {
    // Sanity check the maths against published values before trusting it below.
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1);
  });

  describe.each([
    ['light', lightTheme],
    ['dark', darkTheme],
  ] as const)('%s theme', (_name, theme) => {
    const surfaces = [
      theme.colors.background,
      theme.colors.surface,
      theme.colors.cardBackground,
    ];

    // Every text tier must be legible on every surface it can land on.
    // textTertiary carries the exposure date and the meal/temperature/texture
    // meta row on ExposureCard, the Settings tagline, and the Log form hint —
    // small type, so it needs the full 4.5:1, not the 3:1 large-text allowance.
    it.each(['text', 'textSecondary', 'textTertiary'] as const)(
      '%s meets AA on background, surface and cardBackground',
      (token) => {
        for (const surface of surfaces) {
          expect(contrastRatio(theme.colors[token], surface)).toBeGreaterThanOrEqual(AA_NORMAL);
        }
      }
    );

    it('primaryStrong meets AA as text on light surfaces and on primaryLight chips', () => {
      for (const surface of [...surfaces, theme.colors.primaryLight]) {
        expect(contrastRatio(theme.colors.primaryStrong, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });

    it('onPrimaryStrong meets AA against a primaryStrong filled button', () => {
      expect(
        contrastRatio(theme.colors.onPrimaryStrong, theme.colors.primaryStrong)
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('error text meets AA on every surface (Delete / Sign Out rows)', () => {
      for (const surface of surfaces) {
        expect(contrastRatio(theme.colors.error, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    });
  });
});
