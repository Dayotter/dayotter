import type {
  BookingEventKind,
  BookingEventPayload,
  DayOtterPlugin,
  PluginTool,
} from "@dayotter/plugin-sdk";
import { createContext, createHookContext } from "./context";

/** A tool exposed to the AI layer, with its namespaced name and owning plugin. */
export interface RegisteredTool {
  /** `<pluginId>__<toolName>` - unique across all plugins. */
  name: string;
  pluginId: string;
  tool: PluginTool;
}

const NAMESPACE_SEP = "__";

/**
 * The in-memory registry of installed plugins and their contributions. A single
 * instance is shared per process (see the exported singleton). Registration
 * happens once at startup; the getters are read live wherever the core needs
 * plugin contributions.
 */
export class PluginRegistry {
  private plugins = new Map<string, DayOtterPlugin>();
  private tools = new Map<string, RegisteredTool>();

  register(plugin: DayOtterPlugin): void {
    if (this.plugins.has(plugin.id)) return; // idempotent - safe on repeated import
    this.plugins.set(plugin.id, plugin);
    for (const tool of plugin.tools ?? []) {
      const name = `${plugin.id}${NAMESPACE_SEP}${tool.name}`;
      this.tools.set(name, { name, pluginId: plugin.id, tool });
    }
  }

  list(): DayOtterPlugin[] {
    return [...this.plugins.values()];
  }

  /** All registered Otter tools (namespaced), for building the AI request. */
  registeredTools(): RegisteredTool[] {
    return [...this.tools.values()];
  }

  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** Run a plugin tool for a user. Read tools return context to feed the model;
   *  action tools return a human-facing result message (called after confirm). */
  async runTool(name: string, userId: string, input: Record<string, unknown>): Promise<string> {
    const entry = this.tools.get(name);
    if (!entry) throw new Error(`Unknown plugin tool: ${name}`);
    const ctx = createContext(entry.pluginId, userId);
    return entry.tool.run(ctx, input);
  }

  /** Fan a booking lifecycle event out to every matching hook. Best-effort:
   *  a failing hook is logged by the host caller and never blocks the booking. */
  async runBookingHooks(event: BookingEventKind, payload: BookingEventPayload): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const plugin of this.plugins.values()) {
      for (const hook of plugin.bookingHooks ?? []) {
        if (!hook.on.includes(event)) continue;
        const ctx = createHookContext(plugin.id, payload.hostId);
        jobs.push(
          Promise.resolve()
            .then(() => hook.handle(ctx, event, payload))
            .catch((err) =>
              ctx.logger.error(`booking hook failed (${event})`, { err: String(err) }),
            ),
        );
      }
    }
    await Promise.all(jobs);
  }
}

/** The process-wide registry. Plugins register into this at startup. */
export const registry = new PluginRegistry();
