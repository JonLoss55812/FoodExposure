import { StyleSheet as RNStyleSheet } from 'react-native';

// The real themes, not copies: a hand-copied token list drifted silently
// (a token missing here rendered as undefined in tests). Required lazily
// because theme.ts imports this module for StyleSheet.configure at load time.
// Light unless a test calls setMockTheme('dark') from src/test-utils/mock-theme.
function getThemeName(): 'light' | 'dark' {
  return require('../test-utils/mock-theme').getMockThemeName();
}

function getTheme() {
  const themes = require('../styles/theme');
  return getThemeName() === 'dark' ? themes.darkTheme : themes.lightTheme;
}

export const useUnistyles = () => ({
  get theme() {
    return getTheme();
  },
  rt: {
    get colorScheme() {
      return getThemeName();
    },
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
      // Components call this once, at import, so evaluating the factory here
      // would freeze them in whichever theme was current then. Resolve each
      // style on access instead, caching per theme object.
      const cache = new Map<unknown, any>();
      const resolve = () => {
        const theme = getTheme();
        if (!cache.has(theme)) {
          cache.set(theme, RNStyleSheet.create(sanitizeStyles(stylesOrFn(theme))));
        }
        return cache.get(theme);
      };
      const lazy: any = {};
      for (const key of Object.keys(resolve())) {
        Object.defineProperty(lazy, key, { enumerable: true, get: () => resolve()[key] });
      }
      return lazy;
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
