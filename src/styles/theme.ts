import { StyleSheet } from 'react-native-unistyles';

const sharedColors = {
  // Stage colors
  stageTolerate: '#94A3B8',
  stageInteract: '#60A5FA',
  stageSmell: '#A78BFA',
  stageTouch: '#FB923C',
  stageTaste: '#F472B6',
  stageEat: '#34D399',
  // Category colors
  categoryProtein: '#EF4444',
  categoryVegetable: '#22C55E',
  categoryFruit: '#F59E0B',
  categoryGrain: '#D97706',
  categoryDairy: '#3B82F6',
  categoryOther: '#6B7280',
  // Rating colors
  rating1: '#EF4444',
  rating2: '#F97316',
  rating3: '#EAB308',
  rating4: '#84CC16',
  rating5: '#22C55E',
  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 34,
} as const;

export const lightTheme = {
  colors: {
    ...sharedColors,
    primary: '#F97316',      // Orange - warm, food-related. Decorative fills only.
    // AA-safe orange for text/icons on light surfaces and for filled action
    // backgrounds. #F97316 is only 2.80:1 on white; #C2410C is 5.18:1.
    primaryStrong: '#C2410C',
    onPrimaryStrong: '#FFFFFF',
    // #EF4444 is only 3.76:1 on white; the destructive rows (Delete Food,
    // Delete Child, Sign Out) render it as body-size text, so it needs 4.5:1.
    error: '#DC2626',
    primaryLight: '#FFF7ED',
    primaryDark: '#EA580C',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    surfaceElevated: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#64748B',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    cardBackground: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    inputBackground: '#F8FAFC',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  spacing,
  borderRadius,
  fontSize,
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
} as const;

export const darkTheme = {
  colors: {
    ...sharedColors,
    primary: '#FB923C',
    primaryStrong: '#FB923C',
    onPrimaryStrong: '#0F172A',
    error: '#F87171',
    primaryLight: '#431407',
    primaryDark: '#FDBA74',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceElevated: '#334155',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    border: '#334155',
    borderLight: '#1E293B',
    cardBackground: '#1E293B',
    tabBar: '#1E293B',
    tabBarBorder: '#334155',
    inputBackground: '#1E293B',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  spacing,
  borderRadius,
  fontSize,
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 5,
    },
  },
} as const;

export type AppTheme = typeof lightTheme;

// Breakpoints for responsive design (web)
const breakpoints = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
} as const;

StyleSheet.configure({
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  breakpoints,
  settings: {
    adaptiveThemes: true,
  },
});

// Type augmentation
declare module 'react-native-unistyles' {
  export interface UnistylesThemes {
    light: typeof lightTheme;
    dark: typeof darkTheme;
  }
  export interface UnistylesBreakpoints {
    xs: 0;
    sm: 576;
    md: 768;
    lg: 992;
    xl: 1200;
  }
}
