import { assertPublicHttpUrl, logger, resolvePublicIp } from "@dayotter/core";
import type {
  PluginContext,
  PluginHookContext,
  PluginHttp,
  PluginLogger,
} from "@dayotter/plugin-sdk";
import { createStorage } from "./storage";

/** A logger namespaced to a plugin, so its output is attributable. */
function pluginLogger(pluginId: string): PluginLogger {
  const tag = (meta?: Record<string, unknown>) => ({ event: "plugin", plugin: pluginId, ...meta });
  return {
    info: (m, meta) => logger.info(`[plugin:${pluginId}] ${m}`, tag(meta)),
    warn: (m, meta) => logger.warn(`[plugin:${pluginId}] ${m}`, tag(meta)),
    error: (m, meta) => logger.error(`[plugin:${pluginId}] ${m}`, tag(meta)),
  };
}

/**
 * SSRF-guarded fetch: HTTPS-only, the URL's host + its DNS resolution must both
 * be public, and redirects are not followed (a 3xx is returned as-is). This is
 * the only outbound path a plugin should use to reach an external service.
 */
const safeHttp: PluginHttp = {
  async fetch(url, init) {
    const parsed = assertPublicHttpUrl(url, { requireHttps: true });
    await resolvePublicIp(parsed.hostname); // throws if it resolves to a private IP
    return fetch(parsed, { ...init, redirect: "manual" });
  },
};

/** Config for a plugin, from env vars `DAYOTTER_PLUGIN_<ID>_<KEY>`. */
function pluginConfig(pluginId: string): Readonly<Record<string, string | undefined>> {
  const prefix = `DAYOTTER_PLUGIN_${pluginId.replace(/-/g, "_").toUpperCase()}_`;
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length).toLowerCase()] = v;
  }
  return out;
}

/** Build the runtime context handed to a plugin tool's `run`. */
export function createContext(pluginId: string, userId: string): PluginContext {
  return {
    userId,
    storage: createStorage(pluginId, userId),
    http: safeHttp,
    logger: pluginLogger(pluginId),
    config: pluginConfig(pluginId),
  };
}

/** Build the context handed to a plugin booking hook (scoped to the host). */
export function createHookContext(pluginId: string, hostId: string): PluginHookContext {
  return {
    hostId,
    storage: createStorage(pluginId, hostId),
    http: safeHttp,
    logger: pluginLogger(pluginId),
    config: pluginConfig(pluginId),
  };
}
