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

// 5. Point the bare `zod` specifier at its v4 entry. better-auth (1.6.x) calls
//    zod-v4-only APIs like `.meta()`; with zod 3.25's dual export Metro was
//    resolving the classic v3 module (no `.meta`), so every route module threw
//    at eval time and the app crashed on launch in production (dev tolerated
//    it). The mobile bundle uses zod ONLY via better-auth, so this is safe and
//    keeps all schema instances on one (v4) implementation.
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = moduleName === "zod" ? "zod/v4" : moduleName;
  return baseResolveRequest
    ? baseResolveRequest(context, target, platform)
    : context.resolveRequest(context, target, platform);
};

// 6. Import *.svg files as React components (react-native-svg-transformer).
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = config;
