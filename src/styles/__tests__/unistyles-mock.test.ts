import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { lightTheme } from '../theme';

// The jest mock of react-native-unistyles used to carry a hand-copied theme.
// A token added to theme.ts but not to the copy resolved to undefined in every
// test (black text, no error). The mock now serves the real light theme.
describe('react-native-unistyles jest mock', () => {
  it('serves the real light theme from useUnistyles', () => {
    expect(useUnistyles().theme).toBe(lightTheme);
  });

  it('passes the real light theme to StyleSheet.create factories', () => {
    let received: unknown;
    StyleSheet.create((theme: unknown) => {
      received = theme;
      return {};
    });
    expect(received).toBe(lightTheme);
  });
});
