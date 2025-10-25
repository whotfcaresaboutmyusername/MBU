// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add polyfills for crypto and other node modules
config.resolver.extraNodeModules = {
  crypto: require.resolve('expo-standard-web-crypto'),
};

// Configure source extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// Add asset extensions for libsodium wasm files
config.resolver.assetExts = [...config.resolver.assetExts, 'wasm'];

// Add custom resolver to handle @supabase/node-fetch
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Prevent dynamic import of @supabase/node-fetch
  if (moduleName === '@supabase/node-fetch') {
    return {
      type: 'empty',
    };
  }
  
  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

