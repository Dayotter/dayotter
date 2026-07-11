// Metro config for a pnpm monorepo so the app can import workspace packages
// (e.g. @dayotter/core). See https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes to shared packages are picked up.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. pnpm uses symlinks; keep resolution predictable.
config.resolver.disableHierarchicalLookup = true;

// 4. Resolve packages' `exports` subpaths (e.g. `@better-auth/expo/client`).
//    Default-on in Expo SDK 53; opt-in here on SDK 52.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
