---
name: plugins-extensibility
description: DayOtter's plugin/extension system — in-process, config-listed plugins that extend the product without forking (notes, scribing, custom integrations, booking hooks). Covers the plugin-sdk/plugin-host packages, plugin_data storage, the host context (safeHttp via safeFetch), and the trust model. Load this when adding an extension point, writing a plugin, or touching the plugin host.
---

# Plugins & extensibility

DayOtter is extensible **without forking**: plugins add capabilities (notes,
scribing, custom integrations, extra booking side effects, AI tweaks) that run
alongside the core product.

## Model — in-process, config-listed

- Plugins live in `packages/plugins/*`, are authored against `@dayotter/plugin-sdk`,
  and are hosted by `@dayotter/plugin-host`.
- They are **listed in config and run in-process** (chosen over a sandboxed
  runtime for simplicity/perf). **Trust model: only enable plugins you trust** —
  an enabled plugin has in-process access. Say so in any UI that enables them.
- Per-plugin persistence uses the `plugin_data` table (migration 0040) via the
  host registry — plugins don't get raw DB access.

## Host context & safe egress

The host hands each plugin a context with a **`safeHttp.fetch`** that delegates to
core `safeFetch` (HTTPS-only, DNS-resolved-IP pinned, no redirects). Plugins must
never make raw outbound requests — route them through the provided client so SSRF
protections and no-redirect guarantees hold. See `packages/plugin-host/src/context.ts`.

## Extension points

Booking lifecycle hooks fire from `apps/web/lib/booking/lifecycle.ts`
(`runPluginBookingHooks` inside `fanOutBookingLifecycle`). When adding a new
extension point:
1. Define the hook shape in `plugin-sdk`.
2. Invoke it from the host, wrapped so a misbehaving plugin can't break the core
   flow (best-effort, logged).
3. Give plugins data access only through the host registry / `plugin_data`.

Example plugins (notes, webhook-relay) live in `packages/plugins` as references.

Human docs: search `docs/` for the plugin/extension guide.
