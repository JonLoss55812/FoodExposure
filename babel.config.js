module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // On web, Metro resolves zustand's ESM build, whose middleware reads
          // `import.meta.env`. Untransformed, that is a SyntaxError in the
          // classic-script bundle and the page renders nothing. This rewrites
          // `import.meta` to Expo's runtime registry (v0.5.266).
          unstable_transformImportMeta: true,
        },
      ],
    ],
  };
};
