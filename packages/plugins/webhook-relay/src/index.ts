import { definePlugin } from "@dayotter/plugin-sdk";

/**
 * Webhook Relay - a reference "connector" plugin. It forwards every booking
 * lifecycle event to an external URL of the user's choosing (Zapier, n8n, a
 * homegrown service, a Notes/Notion sink). It shows how a plugin:
 *  1. connects to an external service using the SSRF-guarded `ctx.http`,
 *  2. stores a per-user connector setting (here, the destination URL), and
 *  3. reacts to booking events.
 *
 * The destination comes from per-user storage (set via the Otter tool below) or,
 * as a fallback, the env var DAYOTTER_PLUGIN_WEBHOOK_RELAY_URL (config.url).
 */

async function targetUrl(ctx: {
  storage: { getSecret: (k: string) => Promise<string | null> };
  config: { url?: string };
}): Promise<string | null> {
  return (await ctx.storage.getSecret("url")) ?? ctx.config.url ?? null;
}

export default definePlugin({
  id: "webhook-relay",
  name: "Webhook Relay",
  description: "Forward every booking event to a URL you control.",
  version: "0.1.0",

  tools: [
    {
      name: "set-relay-url",
      description:
        "Set the URL that booking events are forwarded to for this user. Use when the user gives a webhook/endpoint URL for their bookings.",
      kind: "action",
      title: "Set relay URL",
      schema: {
        type: "object",
        properties: { url: { type: "string", description: "An https:// URL to POST events to." } },
        required: ["url"],
      },
      summarize: (input) => `Forward booking events to ${String(input.url)}`,
      async run(ctx, input) {
        const url = String(input.url ?? "").trim();
        if (!/^https:\/\//i.test(url)) return "Please provide an https:// URL.";
        await ctx.storage.setSecret("url", url);
        return `Booking events will now be forwarded to ${url}.`;
      },
    },
  ],

  bookingHooks: [
    {
      on: ["created", "rescheduled", "cancelled"],
      async handle(ctx, event, booking) {
        const url = await targetUrl(ctx);
        if (!url) return; // not configured for this user - nothing to do
        const res = await ctx.http.fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: `booking.${event}`, booking }),
        });
        if (res.status < 200 || res.status >= 300) {
          ctx.logger.warn("relay endpoint returned non-2xx", { status: res.status });
        }
      },
    },
  ],
});
