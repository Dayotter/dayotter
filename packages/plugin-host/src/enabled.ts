import notes from "@dayotter/plugin-notes";
import webhookRelay from "@dayotter/plugin-webhook-relay";
import { registry } from "./registry";

/**
 * The first-party plugins this build knows about. They are OFF by default -
 * nothing changes unless a self-hoster opts in via the DAYOTTER_PLUGINS env var
 * (comma-separated plugin ids), e.g. `DAYOTTER_PLUGINS=notes,webhook-relay`.
 *
 * To add a third-party plugin: install its package, import it here, add it to
 * FIRST_PARTY, and enable its id in DAYOTTER_PLUGINS. (Plugins run in-process
 * with full access - only enable ones you trust.)
 */
const FIRST_PARTY = [notes, webhookRelay];

const enabledIds = new Set(
  (process.env.DAYOTTER_PLUGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

for (const plugin of FIRST_PARTY) {
  if (enabledIds.has(plugin.id)) registry.register(plugin);
}
