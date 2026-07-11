// RN-safe entrypoint: availability types + engine + round-robin, WITHOUT the
// node:crypto token helpers in the package root. Import this from clients that
// can't bundle Node built-ins (e.g. the React Native app):
//   import { computeAvailability, type Slot } from "@dayotter/core/availability";
export * from "./types";
export { computeAvailability, intersectAvailability } from "./engine";
export { roundRobinPick, type RoundRobinCandidate } from "../round-robin";
