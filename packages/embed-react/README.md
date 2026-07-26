# @dayotter/embed-react

White-label React components to embed [DayOtter](https://dayotter.com) scheduling
in your own app. Renders the booking flow in an auto-resizing iframe, so there's
no API token to manage and your bookers get the real, always-up-to-date flow.

```bash
npm install @dayotter/embed-react
```

## Inline booker

```tsx
import { DayOtterBooker } from "@dayotter/embed-react";

export function Contact() {
  return (
    <DayOtterBooker
      handle="ada"
      slug="intro"
      theme="light"
      primaryColor="#6743e6"
      onBookingSuccessful={(b) => console.log("booked", b.uid)}
    />
  );
}
```

The iframe auto-resizes to its content and calls `onBookingSuccessful` when a
booking is confirmed.

## Popup button

```tsx
import { DayOtterButton } from "@dayotter/embed-react";

<DayOtterButton handle="ada" slug="intro">Book a call</DayOtterButton>;
```

Or open it imperatively (works outside React too):

```ts
import { openDayOtterPopup } from "@dayotter/embed-react";

const popup = openDayOtterPopup({ handle: "ada", slug: "intro" });
// popup.close();
```

## Props

| Prop | Type | Notes |
|------|------|-------|
| `handle` | `string` | Your public booking handle (required) |
| `slug` | `string` | The event-type slug (required) |
| `baseUrl` | `string` | Your instance origin. Defaults to `https://dayotter.com` — set it when self-hosting |
| `theme` | `"light" \| "dark" \| "auto"` | Force a colour scheme |
| `primaryColor` | `string` | Accent colour (hex) |
| `hideDetails` | `boolean` | Show only the time picker |
| `onBookingSuccessful` | `(b: { uid, url }) => void` | Fired on confirmation |
| `onHeightChange` | `(height: number) => void` | Inline booker only |

Self-hosting? Point `baseUrl` at your instance — the components load
`${baseUrl}/embed/<handle>/<slug>`.
