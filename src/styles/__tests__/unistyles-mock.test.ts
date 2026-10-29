import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { darkTheme, lightTheme } from '../theme';
import { setMockTheme } from '@/src/test-utils/mock-theme';

// The jest mock of react-native-unistyles used to carry a hand-copied theme.
// A token added to theme.ts but not to the copy resolved to undefined in every
// test (black text, no error). The mock now serves the real light theme.
describe('react-native-unistyles jest mock', () => {
  afterEach(() => setMockTheme('light'));

  it('serves the real light theme from useUnistyles', () => {
    expect(useUnistyles().theme).toBe(lightTheme);
  });

  it('passes the real light theme to StyleSheet.create factories', () => {
    let received: unknown;
    const styles = StyleSheet.create((theme: unknown) => {
      received = theme;
      return { box: {} };
    });
    void styles.box;
    expect(received).toBe(lightTheme);
  });

  // Until setMockTheme existed, no rendered test could see the dark theme, so
  // a dark-mode regression (v0.5.237: an error screen with no background) was
  // covered only by the contrast suite's token pairings.
  it('serves the real dark theme from useUnistyles after setMockTheme', () => {
    setMockTheme('dark');
    const { theme, rt } = useUnistyles();
    expect(theme).toBe(darkTheme);
    expect(rt.colorScheme).toBe('dark');
  });

  it('resolves a module-level StyleSheet factory against the theme at access time', () => {
    // Components call StyleSheet.create once, at import. Evaluating the
    // factory there would freeze every component in the light theme.
    const styles = StyleSheet.create((theme) => ({
      box: { backgroundColor: theme.colors.background },
    }));
    expect(styles.box.backgroundColor).toBe(lightTheme.colors.background);
    setMockTheme('dark');
    expect(styles.box.backgroundColor).toBe(darkTheme.colors.background);
    setMockTheme('light');
    expect(styles.box.backgroundColor).toBe(lightTheme.colors.background);
  });

  it('still strips shadow props, which react-native-web rejects', () => {
    const styles = StyleSheet.create(() => ({
      card: { shadowColor: '#000', shadowOpacity: 0.2, elevation: 3, padding: 4 },
    }));
    expect(styles.card).toEqual({ padding: 4 });
  });
});
