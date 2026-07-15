# @dayotter/plugin-sdk

The public contract for building **DayOtter extensions** - small packages that
add capabilities (Otter tools, booking reactions, connectors) without forking the
core. This package has **no runtime dependencies** and knows nothing about
DayOtter's database or internals; the host (`@dayotter/plugin-host`) supplies the
runtime context and wires your contributions into the product.

## Quick start

```ts
import { definePlugin } from "@dayotter/plugin-sdk";

export default definePlugin({
  id: "notes", // stable, kebab-case - namespaces your tools + storage
  name: "Notes",
  version: "0.1.0",

  // AI capabilities Otter can use.
  tools: [
    {
      name: "save-note",
      description: "Save a short note for the user.",
      kind: "action", // "read" runs inline; "action" is confirm-first
      title: "Save note",
      schema: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
      summarize: (input) => `Save a note`,
      async run(ctx, input) {
        await ctx.storage.set(`note:${Date.now()}`, { text: input.text });
        return "Saved your note.";
      },
    },
  ],

  // React to meetings being booked / moved / cancelled.
  bookingHooks: [
    {
      on: ["created"],
      async handle(ctx, _event, booking) {
        await ctx.storage.set(`note:booking:${booking.bookingId}`, {
          subject: booking.title,
        });
      },
    },
  ],
});
```

## The runtime context

Every tool `run` and hook `handle` receives a context:

| Field | What it is |
|---|---|
| `storage` | Per-plugin, per-user KV. `get/set/delete/list` for JSON, `getSecret/setSecret` for encrypted credentials. Scoped - you can't read another plugin's data. |
| `http` | An SSRF-guarded `fetch`: HTTPS-only, public hosts only, no redirects followed. Use it for every outbound call. |
| `logger` | Structured logger, namespaced to your plugin. |
| `config` | Read-only values from env `DAYOTTER_PLUGIN_<ID>_<KEY>`. |
| `userId` / `hostId` | The user the call acts for. |

## Contribution types

- **`PluginTool`** - an Otter capability. `kind: "read"` returns a string fed back
  to the model; `kind: "action"` is **confirm-first** (Otter proposes a card, the
  human approves before `run` executes). Set `danger: true` for destructive
  actions that need a second confirmation.
- **`BookingHook`** - runs best-effort after a booking is created / rescheduled /
  cancelled. A throw is logged and swallowed - it never blocks the booking.

## Enabling

Plugins are **off by default**. A self-hoster imports your package in
`packages/plugin-host/src/enabled.ts` and turns it on via
`DAYOTTER_PLUGINS=your-id,other-id`.

> Plugins run **in-process with full access** - only enable ones you trust.

See the reference plugins under `packages/plugins/` (`notes`, `webhook-relay`) and
the [Building extensions](https://dayotter.com/docs/building-extensions) guide.
