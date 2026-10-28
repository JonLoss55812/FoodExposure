import { StyleSheet as RNStyleSheet } from 'react-native';

// The real light theme, not a copy: a hand-copied token list drifted silently
// (a token missing here rendered as undefined in tests). Required lazily
// because theme.ts imports this module for StyleSheet.configure at load time.
function getTheme() {
  return require('../styles/theme').lightTheme;
}

export const useUnistyles = () => ({
  get theme() {
    return getTheme();
  },
  rt: {
    colorScheme: 'light',
    screen: { width: 375, height: 812 },
    breakpoint: 'xs',
  },
});

// Strip shadow* props that react-native-web rejects, and other non-web props
function sanitizeStyles(styles: any) {
  const result: any = {};
  for (const [key, value] of Object.entries(styles)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const clean: any = {};
      for (const [k, v] of Object.entries(value as any)) {
        if (!k.startsWith('shadow') && k !== 'elevation') {
          clean[k] = v;
        }
      }
      result[key] = clean;
    } else {
      result[key] = value;
    }
  }
  return result;
}

export const StyleSheet = {
  create: (stylesOrFn: any) => {
    if (typeof stylesOrFn === 'function') {
      return RNStyleSheet.create(sanitizeStyles(stylesOrFn(getTheme())));
    }
    return RNStyleSheet.create(sanitizeStyles(stylesOrFn));
  },
  configure: () => {},
};

export const Display = ({ children }: any) => children;
export const Hide = ({ children }: any) => children;
export const ScopedTheme = ({ children }: any) => children;
export const UnistylesRuntime = {};
export const mq = {};
export const withUnistyles = (component: any) => component;
export const createUnistylesElement = (component: any) => component;
