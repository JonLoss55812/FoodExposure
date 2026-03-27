import { StyleSheet as RNStyleSheet } from 'react-native';

const mockTheme = {
  colors: {
    primary: '#F97316',
    primaryLight: '#FFF7ED',
    primaryDark: '#EA580C',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceElevated: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    cardBackground: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    inputBackground: '#F8FAFC',
    overlay: 'rgba(0, 0, 0, 0.5)',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    white: '#FFFFFF',
    black: '#000000',
    stageTolerate: '#94A3B8',
    stageInteract: '#60A5FA',
    stageSmell: '#A78BFA',
    stageTouch: '#FB923C',
    stageTaste: '#F472B6',
    stageEat: '#34D399',
    categoryProtein: '#EF4444',
    categoryVegetable: '#22C55E',
    categoryFruit: '#F59E0B',
    categoryGrain: '#D97706',
    categoryDairy: '#3B82F6',
    categoryOther: '#6B7280',
    rating1: '#EF4444',
    rating2: '#F97316',
    rating3: '#EAB308',
    rating4: '#84CC16',
    rating5: '#22C55E',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  borderRadius: { sm: 6, md: 12, lg: 16, xl: 24, full: 9999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, xxxl: 34 },
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5 },
  },
};

export const useUnistyles = () => ({
  theme: mockTheme,
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
      return RNStyleSheet.create(sanitizeStyles(stylesOrFn(mockTheme)));
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
