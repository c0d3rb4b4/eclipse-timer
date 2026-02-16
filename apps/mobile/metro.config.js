// apps/mobile/metro.config.js
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Keep Expo defaults, but add monorepo watch folder
config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));

// Ensure Metro can resolve modules from both places (Expo defaults + workspace)
config.resolver.nodeModulesPaths = Array.from(
  new Set([
    ...(config.resolver.nodeModulesPaths ?? []),
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ]),
);

// Make sure TS from workspace packages is supported
config.resolver.sourceExts = Array.from(
  new Set([...(config.resolver.sourceExts ?? []), "ts", "tsx"]),
);

// expo-notifications transitively imports "@ide/backoff", which requires Node "assert".
// Provide a tiny React Native-safe alias so Metro doesn't require Node stdlib polyfills.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  assert: path.resolve(projectRoot, "src/polyfills/assert.js"),
};

module.exports = config;
