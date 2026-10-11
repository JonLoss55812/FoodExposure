// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web worker imports `wa-sqlite.wasm`; Metro cannot bundle that
// import (and `expo export --platform web` fails) unless wasm is an asset.
config.resolver.assetExts.push('wasm');

// The same worker needs SharedArrayBuffer, which browsers only expose to a
// cross-origin-isolated page. These headers cover the dev server; a static
// host serving the web export must send them too.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
