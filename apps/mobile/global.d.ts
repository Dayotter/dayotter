// Expo inlines EXPO_PUBLIC_* env vars into process.env at build time. Declare the
// minimal shape so TypeScript is happy without pulling in all of @types/node.
declare const process: { env: Record<string, string | undefined> };

// *.svg files are imported as React components via react-native-svg-transformer.
declare module "*.svg" {
  import type { FC } from "react";
  import type { SvgProps } from "react-native-svg";
  const content: FC<SvgProps>;
  export default content;
}
