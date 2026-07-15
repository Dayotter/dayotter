import { logger, safeFetch } from "@dayotter/core";
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

/** Normalise fetch headers to a plain string record for the core safeFetch. */
function toHeaderRecord(h: RequestInit["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  const entries =
    h instanceof Headers ? [...h.entries()] : Array.isArray(h) ? h : Object.entries(h);
  for (const [k, v] of entries) out[k] = Array.isArray(v) ? v.join(", ") : String(v);
  return out;
}

/**
 * The plugin HTTP client: the single pinned, SSRF-safe fetch from @dayotter/core
 * (HTTPS-only, connection pinned to the validated public IP, no redirects). This
 * is the only outbound path a plugin should use to reach an external service.
 */
const safeHttp: PluginHttp = {
  fetch(url, init) {
    return safeFetch(url, {
      method: init?.method,
      headers: toHeaderRecord(init?.headers),
      body: typeof init?.body === "string" ? init.body : undefined,
    });
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
