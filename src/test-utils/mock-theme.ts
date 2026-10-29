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
