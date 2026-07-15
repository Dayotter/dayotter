---
name: frontend-conventions
description: apps/web UI conventions — theme tokens and class-based dark mode, the marketing/docs/blog width tiers, brand typography (Geist, no serif), illustration gotchas (baked light frames cause dark-mode edges), reveal animations, and the Card system. Load this when doing marketing or app UI work so new pages match the rest of the site.
---

# Frontend conventions (apps/web)

## Theme & tokens

- **Dark mode is class-based** — `.dark` on `<html>`, driven by the theme toggle
  (not `prefers-color-scheme`). Tokens live in `app/globals.css` (light `@theme`
  block + `.dark` overrides). Always style via CSS variables
  (`var(--color-surface)`, `--color-text`, `--color-muted`, `--color-faint`,
  `--color-border`, `--color-accent`…), never hard-coded hex.
- **Typography: Geist sans everywhere** (`font-display` for headings). No Fraunces/
  serif — that was deliberately removed.
- Use the `Card` / `CardHeader` / `CardBody` system (`components/ui/card.tsx`) for
  app surfaces so elevation/rhythm stays consistent.

## Width tiers (keep pages consistent — a "smooth feel" across navigation)

- **Browse** (`max-w-5xl`): hub/index pages, detail pages, docs index.
- **Read** (`max-w-3xl`): articles, blog, changelog, status, legal (the shared
  `Prose` in `components/marketing/page-shell.tsx`), vs/glossary detail.
- **Landing** (`max-w-6xl`): home sections, pricing, the docs-article grid.

When adding a marketing/docs page, pick the tier that matches its type — don't
introduce a new width.

## Illustrations (dark-mode gotcha)

Brand PNGs under `public/brand/illustrations/` are otter scenes. Most have
transparent/dark edges and sit fine on dark backgrounds. **`otter-banner.png` had
a baked light frame** (a light border ring) that read as a "weird white edge" in
dark mode — it was trimmed at the source and wrapped in `overflow-hidden`. If you
add an illustration with a light background/rim, either trim the source or frame
it so it doesn't clash on the dark theme. Badges are transparent-edged; scene
portraits (focus/agenda) have light skies that are content, not frames.

## Reveal animations / dev quirk

Marketing sections use scroll reveal (opacity/transform) and can render
`content-visibility` off-screen. In headless/dev captures a deep-scroll section
may screenshot blank even though it's in the DOM — force a repaint (resize) or
verify via measured layout / SSR HTML rather than assuming it's broken. The dev
home page can also blank during Fast Refresh; SSR is complete — it's a dev quirk.

## Settings & app layout

The app shell is a fixed sidebar + a single scrolling `<main>`. Sub-nav rails
(e.g. settings) should be `lg:sticky lg:self-start` so only content scrolls, not
the rail. Toggles: border in *both* states + `inline-flex items-center` so the
knob stays centered and the track doesn't shift on toggle.
