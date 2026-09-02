module.exports = {
  preset: 'jest-expo/web',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|native-base|react-native-svg|posthog-react-native|uuid)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/convex/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    // Screens are where the write paths, DB access and Alert wiring live.
    // Leaving them out of the denominator reported 100% while the four main
    // tabs were at 0%; include them so the gap is visible in the report.
    'app/**/*.tsx',
    '!app/**/_layout.tsx',
    '!src/**/index.ts',
    '!src/styles/**',
    '!src/providers/**',
    '!src/test-utils/**',
  ],
};
