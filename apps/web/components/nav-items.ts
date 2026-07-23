import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Clock,
  Inbox,
  LayoutDashboard,
  Settings,
  Split,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";

/**
 * Shared primary navigation, used by the desktop sidebar and the mobile tab bar.
 * Ordered by daily use: home first, then the scheduling tools you touch most,
 * then the calmer surfaces. Booking analytics live inside Insights (one nav item,
 * two tabs) to keep the list short.
 */
export const NAV = [
  { href: "/dashboard", label: "Home", short: "Home", icon: LayoutDashboard },
  { href: "/event-types", label: "Booking Types", short: "Types", icon: CalendarClock },
  { href: "/availability", label: "Availability", short: "Hours", icon: Clock },
  { href: "/bookings", label: "Bookings", short: "Bookings", icon: CalendarDays },
  { href: "/polls", label: "Group polls", short: "Polls", icon: Vote },
  { href: "/routing", label: "Routing forms", short: "Routing", icon: Split },
  { href: "/inbox", label: "Inbox", short: "Inbox", icon: Inbox },
  { href: "/teams", label: "Teams", short: "Teams", icon: Users },
  { href: "/insights", label: "Insights", short: "Insights", icon: ChartColumn },
  { href: "/settings/profile", label: "Settings", short: "Settings", icon: Settings },
] as const;

/** Tabs within the Insights area (time insights + booking analytics). */
export const INSIGHTS_NAV = [
  { href: "/insights", label: "Time insights", icon: ChartColumn },
  { href: "/analytics", label: "Booking analytics", icon: TrendingUp },
] as const;

/** Sub-navigation inside the Settings area (rendered as tabs by the settings layout). */
export const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/automations", label: "Automations" },
  { href: "/settings/packages", label: "Packages" },
  { href: "/settings/payouts", label: "Payouts" },
  { href: "/settings/calendars", label: "Calendars" },
  { href: "/settings/crm", label: "CRM" },
  { href: "/settings/import", label: "Import" },
  { href: "/settings/billing", label: "Billing" },
  { href: "/settings/developer", label: "Developer" },
] as const;
