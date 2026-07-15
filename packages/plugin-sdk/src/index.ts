/**
 * DayOtter Plugin SDK - the public contract third parties build against.
 *
 * A plugin is a small package that default-exports `definePlugin({...})` and
 * contributes capabilities without forking the core: new Otter tools (AI
 * actions), reactions to booking lifecycle events, and - through the host
 * context - persistent storage and a safe HTTP client for connecting to
 * external services.
 *
 * This package has NO runtime dependencies and knows nothing about DayOtter's
 * database or internals. The host (@dayotter/plugin-host) supplies the runtime
 * context and wires contributions into the product. Keeping the contract here,
 * separate and stable, is what makes the system safe to extend.
 */

// ── Runtime context every plugin function receives ──────────────────────────

/** Structured logger, namespaced to your plugin. */
export interface PluginLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Per-plugin, per-user key/value storage. Values are JSON. Secrets are stored
 * encrypted at rest (use them for API tokens, connector credentials). Scoped to
 * your plugin id and the current user - you can't read another plugin's data.
 */
export interface PluginStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  /** All entries whose key starts with `prefix` (or everything, if omitted). */
  list<T = unknown>(prefix?: string): Promise<{ key: string; value: T }[]>;
  /** Encrypted-at-rest string storage, for credentials. */
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
}

/**
 * A `fetch` hardened against SSRF: HTTPS-only, public hosts only, no redirects
 * followed, connection pinned to the validated IP. Use it for every outbound
 * call to an external service so a plugin can't be tricked into hitting internal
 * infrastructure.
 */
export interface PluginHttp {
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

/** The context handed to a plugin's runtime functions. */
export interface PluginContext {
  /** The user this call is acting for. */
  userId: string;
  storage: PluginStorage;
  http: PluginHttp;
  logger: PluginLogger;
  /** Read-only plugin config (from env `DAYOTTER_PLUGIN_<ID>_<KEY>` or install config). */
  config: Readonly<Record<string, string | undefined>>;
}

// ── Contribution: Otter tools (AI capabilities) ─────────────────────────────

/**
 * A capability the Otter assistant can use. `read` tools run inline and feed
 * their result back to the model (answering questions). `action` tools are
 * confirm-first: Otter proposes an editable card and the human must approve
 * before `run` executes - set `danger` for a second confirmation.
 */
export interface PluginTool {
  /** Unique within your plugin; the host namespaces it as `<pluginId>__<name>`. */
  name: string;
  description: string;
  /** JSON Schema for the tool's input, handed to the model. */
  schema: Record<string, unknown>;
  kind: "read" | "action";
  /** Confirm-card title (action tools). */
  title?: string;
  /** One-line summary of what confirming will do (action tools). */
  summarize?: (input: Record<string, unknown>) => string;
  /** Require a second, explicit confirmation (destructive actions). */
  danger?: boolean;
  /**
   * Execute the tool. For `read`, return a compact string fed back to the model.
   * For `action`, return a short human-facing result message shown after confirm.
   */
  run(ctx: PluginContext, input: Record<string, unknown>): Promise<string>;
}

// ── Contribution: booking lifecycle hooks ───────────────────────────────────

export type BookingEventKind = "created" | "rescheduled" | "cancelled";

/** The booking a hook receives. Times are ISO-8601 UTC strings. */
export interface BookingEventPayload {
  bookingId: string;
  uid: string;
  hostId: string;
  eventTypeId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  attendees: { name: string | null; email: string }[];
  /** Cancellation reason, when present. */
  reason?: string | null;
}

/** Context for a hook - like PluginContext but scoped to the booking's host. */
export interface PluginHookContext {
  hostId: string;
  storage: PluginStorage;
  http: PluginHttp;
  logger: PluginLogger;
  config: Readonly<Record<string, string | undefined>>;
}

/**
 * React to a booking being created, rescheduled, or cancelled. Runs best-effort
 * after the booking is committed - a throw is logged and swallowed, never
 * blocking the booking. Ideal for notes, transcription kickoff, and syncing to
 * an external system.
 */
export interface BookingHook {
  /** Which events to run for. */
  on: BookingEventKind[];
  handle(
    ctx: PluginHookContext,
    event: BookingEventKind,
    payload: BookingEventPayload,
  ): Promise<void>;
}

// ── The plugin ──────────────────────────────────────────────────────────────

export interface DayOtterPlugin {
  /** Stable, unique id (kebab-case). Namespaces your tools and storage. */
  id: string;
  /** Human name shown in settings. */
  name: string;
  description?: string;
  version?: string;
  /** Otter tools this plugin adds. */
  tools?: PluginTool[];
  /** Booking lifecycle reactions. */
  bookingHooks?: BookingHook[];
}

/** Identity helper that also type-checks your plugin against the contract. */
export function definePlugin(plugin: DayOtterPlugin): DayOtterPlugin {
  return plugin;
}
