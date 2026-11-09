/**
 * Which theme the jest mock of react-native-unistyles serves. Lives here, not
 * in the mock, so a test can import it under its own path: importing the mock
 * file directly would give the test a second module instance whose switch the
 * mocked 'react-native-unistyles' never sees.
 *
 * Each test file gets a fresh module registry, so the theme starts as 'light'
 * per file; a test that switches it should switch back in `afterEach`.
 */
export type MockThemeName = 'light' | 'dark';

let current: MockThemeName = 'light';

export function setMockTheme(name: MockThemeName): void {
  current = name;
}

export function getMockThemeName(): MockThemeName {
  return current;
}

/**
 * A `#RRGGBB` theme token as jsdom's `getComputedStyle` reports it, so a
 * rendered colour can be compared with `lightTheme`/`darkTheme` directly.
 */
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * A theme token with a two-digit hex alpha suffix appended (`colors.error +
 * '15'`), as it reaches jsdom. react-native-web converts 8-digit hex itself
 * and rounds the alpha with `toFixed(2)`, so `'15'` arrives as `0.08` (jsdom
 * alone would report `0.082`).
 */
export function rgba(hex: string, alpha: string): string {
  const a = Number((parseInt(alpha, 16) / 255).toFixed(2));
  return rgb(hex).replace('rgb(', 'rgba(').replace(')', `, ${a})`);
}
