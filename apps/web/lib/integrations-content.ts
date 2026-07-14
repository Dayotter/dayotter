/**
 * Integration landing pages, rendered at /integrations and /integrations/[slug].
 * One page per integration - Calendly's highest-volume programmatic-SEO play
 * ("DayOtter + Outlook", etc.). Each targets "<tool> scheduling / integration"
 * search intent and links into the product.
 */

export interface Integration {
  slug: string;
  name: string;
  category: "Calendar" | "Video" | "Messaging" | "Payments" | "CRM";
  blurb: string;
  subtitle: string;
  intro: string[];
  points: { title: string; body: string }[];
  faq: { q: string; a: string }[];
}

export const INTEGRATIONS: Integration[] = [
  {
    slug: "google-calendar",
    name: "Google Calendar",
    category: "Calendar",
    blurb: "Two-way, real-time sync with your Google Calendar.",
    subtitle:
      "Connect Google Calendar and DayOtter keeps your availability honest and writes every booking back - in real time.",
    intro: [
      "DayOtter reads your Google Calendar busy times so you're never double-booked, and writes new bookings straight to your calendar with a Google Meet link attached. Sync is real-time via Google's push notifications.",
      "It's a scheduling layer on top of Google Calendar, not a replacement - everything stays in the calendar you already live in.",
    ],
    points: [
      {
        title: "Real-time sync",
        body: "Changes flow both ways instantly via Google push channels.",
      },
      {
        title: "Auto Google Meet links",
        body: "Every booking gets a Meet link generated and attached.",
      },
      {
        title: "Never double-booked",
        body: "Availability is computed against your real Google busy times.",
      },
    ],
    faq: [
      {
        q: "Does DayOtter replace Google Calendar?",
        a: "No - it works with it. Your bookings show up in the Google Calendar you already use.",
      },
    ],
  },
  {
    slug: "outlook",
    name: "Microsoft Outlook",
    category: "Calendar",
    blurb: "Sync availability and bookings with Microsoft 365 / Outlook.",
    subtitle:
      "Connect Microsoft 365 and DayOtter syncs your Outlook calendar both ways, with Teams links on every booking.",
    intro: [
      "DayOtter reads your Outlook / Microsoft 365 busy times and writes bookings back via Microsoft Graph, kept fresh in real time with Graph subscriptions.",
      "Great for teams standardized on Microsoft who want modern scheduling without leaving Outlook.",
    ],
    points: [
      { title: "Microsoft 365 sync", body: "Two-way sync via Microsoft Graph, real-time." },
      { title: "Teams links", body: "Microsoft Teams meeting links attached automatically." },
      {
        title: "Works alongside Google/Apple",
        body: "Combine Outlook with your other calendars into one view.",
      },
    ],
    faq: [
      {
        q: "Does it work with Microsoft 365 and Outlook.com?",
        a: "Yes - connect your Microsoft account and DayOtter syncs your calendar via Microsoft Graph.",
      },
    ],
  },
  {
    slug: "apple-calendar",
    name: "Apple iCloud Calendar",
    category: "Calendar",
    blurb: "Sync your Apple iCloud calendar - which some tools dropped.",
    subtitle:
      "Connect Apple iCloud via CalDAV and keep your availability accurate - a calendar some competitors stopped supporting.",
    intro: [
      "DayOtter syncs your Apple iCloud calendar over CalDAV using an app-specific password. Your iCloud busy times count toward your availability, and bookings land where you want them.",
      "Unlike some scheduling tools that dropped iCloud support, DayOtter keeps it - one honest view across Google, Outlook, and Apple.",
    ],
    points: [
      { title: "CalDAV sync", body: "Connect with an app-specific password; no extra app needed." },
      { title: "Still supported", body: "iCloud remains first-class here, not deprecated." },
      {
        title: "Unified availability",
        body: "iCloud busy times combine with your other calendars.",
      },
    ],
    faq: [
      {
        q: "How do I connect Apple/iCloud?",
        a: "Generate an app-specific password in your Apple ID settings and add it in DayOtter - that's it.",
      },
    ],
  },
  {
    slug: "zoom",
    name: "Zoom",
    category: "Video",
    blurb: "Auto-create a Zoom meeting for every booking.",
    subtitle:
      "Connect Zoom and DayOtter generates a Zoom meeting link for each booking, added to the calendar invite automatically.",
    intro: [
      "Set an event type's location to Zoom and every booking gets a fresh Zoom meeting created and attached to the invite - no manual link-copying.",
      "Works alongside Google Meet and Teams; pick per event type.",
    ],
    points: [
      {
        title: "Auto-generated links",
        body: "A unique Zoom meeting per booking, attached to the invite.",
      },
      {
        title: "Per event type",
        body: "Choose Zoom for some booking types and Meet/Teams for others.",
      },
    ],
    faq: [
      {
        q: "Does each booking get its own Zoom link?",
        a: "Yes - a fresh Zoom meeting is created per booking and added to the calendar invite.",
      },
    ],
  },
  {
    slug: "google-meet",
    name: "Google Meet",
    category: "Video",
    blurb: "Google Meet links on every Google-calendar booking, automatically.",
    subtitle:
      "With Google Calendar connected, DayOtter attaches a Google Meet link to every booking - no configuration needed.",
    intro: [
      "Google Meet works out of the box with a connected Google Calendar: set the location to Meet and DayOtter attaches a video link to each booking automatically.",
      "The simplest video option if your team is on Google Workspace.",
    ],
    points: [
      { title: "Zero setup", body: "No separate connection - it rides on your Google Calendar." },
      { title: "Automatic links", body: "Every Meet booking gets a link in the invite." },
    ],
    faq: [
      {
        q: "Do I need to connect Google Meet separately?",
        a: "No - connecting Google Calendar is enough; Meet links are attached automatically.",
      },
    ],
  },
  {
    slug: "slack",
    name: "Slack",
    category: "Messaging",
    blurb: "Get booking reminders and nudges in Slack.",
    subtitle:
      "Add a Slack channel and DayOtter can send you reminders and running-late nudges where your team already works.",
    intro: [
      "Connect Slack via an incoming webhook and receive meeting reminders and Otter's nudges in Slack - alongside email, SMS, WhatsApp, and push.",
      "Handy for staying on top of your day without another inbox.",
    ],
    points: [
      {
        title: "Reminders in Slack",
        body: "Upcoming-meeting and running-late notices delivered to Slack.",
      },
      {
        title: "One of many channels",
        body: "Mix Slack with email, SMS, WhatsApp, and push as you like.",
      },
    ],
    faq: [
      {
        q: "How does the Slack connection work?",
        a: "You add a Slack incoming webhook URL in settings; DayOtter posts your notifications there.",
      },
    ],
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "Payments",
    blurb: "Charge or take a deposit to book - powered by Stripe.",
    subtitle:
      "Connect Stripe to require payment or a deposit before a slot is held, and to sell prepaid session packages.",
    intro: [
      "With Stripe connected, DayOtter can charge the full price or a deposit as part of booking via Stripe Checkout - the slot confirms only once payment succeeds.",
      "You can also sell prepaid session bundles that clients buy once and spend as they book.",
    ],
    points: [
      { title: "Paid bookings", body: "Full price or deposit, taken through Stripe Checkout." },
      {
        title: "Session packages",
        body: "Sell bundles; each booking spends a credit, tracked automatically.",
      },
      { title: "No card data stored", body: "Payments run entirely on Stripe." },
    ],
    faq: [
      {
        q: "Is Stripe required to take payments?",
        a: "Yes - connect a Stripe account and you can charge for bookings and sell packages.",
      },
    ],
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    category: "Messaging",
    blurb: "Reminders on WhatsApp - and talk to Otter there too.",
    subtitle:
      "Send booking reminders over WhatsApp, and let people chat with Otter to book and reschedule right from WhatsApp.",
    intro: [
      "With Twilio configured, DayOtter delivers reminders over WhatsApp - where response rates beat email. And Otter is available inbound: text it to book, reschedule, or check your day, confirm-first.",
      "A differentiator neither Calendly nor Cal.com offers.",
    ],
    points: [
      {
        title: "WhatsApp reminders",
        body: "Deliver reminders and nudges where people actually reply.",
      },
      {
        title: "Talk to Otter",
        body: "Text Otter to book or reschedule - it drafts and waits for your OK.",
      },
    ],
    faq: [
      {
        q: "Can I message the assistant on WhatsApp?",
        a: "Yes - inbound WhatsApp lets you ask Otter to book, move, or check meetings, confirm-first.",
      },
    ],
  },
  {
    slug: "microsoft-teams",
    name: "Microsoft Teams",
    category: "Video",
    blurb: "Teams meeting links on every Microsoft-calendar booking.",
    subtitle:
      "With Microsoft 365 connected, DayOtter attaches a Microsoft Teams meeting link to each booking automatically.",
    intro: [
      "Set an event type's location to Teams and every booking gets a Teams meeting link created via Microsoft Graph and added to the invite.",
      "The natural video option for teams on Microsoft 365.",
    ],
    points: [
      {
        title: "Automatic Teams links",
        body: "A Teams meeting per booking, in the calendar invite.",
      },
      {
        title: "Rides on Microsoft 365",
        body: "No separate setup beyond your Microsoft connection.",
      },
    ],
    faq: [
      {
        q: "Do I need extra setup for Teams links?",
        a: "No - connect Microsoft 365 and choose Teams as the location; links are attached automatically.",
      },
    ],
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    category: "CRM",
    blurb: "Log every booking to Salesforce as an Event on the right Contact (beta).",
    subtitle:
      "Connect Salesforce and DayOtter finds or creates the guest as a Contact and logs the meeting as an Event - updated on reschedule, removed on cancel.",
    intro: [
      "When someone books, DayOtter matches them to a Salesforce Contact by email (creating one if needed) and writes the meeting as an Event linked to that Contact. Reschedules update the same Event; cancellations remove it - so your CRM reflects reality without manual logging.",
      "It's a native, first-party sync over the Salesforce REST API - no Zapier in the middle. Currently in beta.",
    ],
    points: [
      {
        title: "Contact find-or-create",
        body: "Guests are matched to a Salesforce Contact by email, or created if new - no duplicates.",
      },
      {
        title: "Meetings logged as Events",
        body: "Each booking becomes a Salesforce Event on the Contact, kept in sync on reschedule and cancel.",
      },
      {
        title: "Native, not a bridge",
        body: "A direct OAuth connection over Salesforce's REST API - connect once in settings.",
      },
    ],
    faq: [
      {
        q: "Does DayOtter create Salesforce Contacts?",
        a: "Yes - it matches the guest to an existing Contact by email, or creates one, then logs the meeting as an Event against it.",
      },
      {
        q: "Is CRM sync included?",
        a: "It's a Pro feature on the cloud, and free when you self-host. Native Salesforce sync is currently in beta.",
      },
    ],
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    category: "CRM",
    blurb: "Create the HubSpot contact and log the meeting on every booking (beta).",
    subtitle:
      "Connect HubSpot and DayOtter creates or matches the contact and logs the booking as a meeting engagement - kept in sync as things change.",
    intro: [
      "Every booking finds or creates the guest as a HubSpot contact and logs a meeting engagement associated with them. Reschedules update the same meeting; cancellations close it out - so your pipeline activity stays accurate automatically.",
      "A native sync over HubSpot's CRM v3 API, connected with one click. Currently in beta.",
    ],
    points: [
      {
        title: "Contact create-or-match",
        body: "Guests are matched to a HubSpot contact by email, or created - then the meeting is associated to them.",
      },
      {
        title: "Meetings logged automatically",
        body: "Each booking is written as a HubSpot meeting engagement, updated on reschedule and closed on cancel.",
      },
      {
        title: "One-click OAuth",
        body: "Connect from settings - no API keys to paste, no third-party automation tool.",
      },
    ],
    faq: [
      {
        q: "Will bookings show up on the HubSpot contact timeline?",
        a: "Yes - each booking is logged as a meeting engagement associated with the contact, so it appears on their timeline.",
      },
      {
        q: "Do I need Zapier for this?",
        a: "No - it's a native, first-party HubSpot sync. It's a Pro feature (free on self-host), currently in beta.",
      },
    ],
  },
];

export function getIntegration(slug: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.slug === slug);
}
