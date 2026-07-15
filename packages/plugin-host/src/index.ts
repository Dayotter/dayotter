import type { BookingEventKind, BookingEventPayload } from "@dayotter/plugin-sdk";
import "./enabled"; // side-effect: register the plugins enabled via DAYOTTER_PLUGINS
import { registry } from "./registry";

export { registry, PluginRegistry } from "./registry";
export type { RegisteredTool } from "./registry";
export { createContext, createHookContext } from "./context";

/** Every registered plugin Otter tool (namespaced), for building the AI request. */
export function pluginTools() {
  return registry.registeredTools();
}

/** Look up a plugin tool by its namespaced name (`<pluginId>__<name>`). */
export function getPluginTool(name: string) {
  return registry.getTool(name);
}

/** Run a plugin tool for a user (read → model context; action → result message). */
export function runPluginTool(name: string, userId: string, input: Record<string, unknown>) {
  return registry.runTool(name, userId, input);
}

/** Fan a booking lifecycle event out to plugin hooks. Best-effort - never throws. */
export async function runPluginBookingHooks(
  event: BookingEventKind,
  payload: BookingEventPayload,
): Promise<void> {
  try {
    await registry.runBookingHooks(event, payload);
  } catch {
    // hooks are individually guarded; this is a final backstop
  }
}
