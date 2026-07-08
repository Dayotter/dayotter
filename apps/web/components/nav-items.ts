import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Clock,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";

/** Shared primary navigation, used by the desktop sidebar and the mobile tab bar. */
export const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/event-types", label: "Event Types", short: "Events", icon: CalendarClock },
  { href: "/teams", label: "Teams", short: "Teams", icon: Users },
  { href: "/bookings", label: "Bookings", short: "Bookings", icon: CalendarDays },
  { href: "/insights", label: "Insights", short: "Insights", icon: ChartColumn },
  { href: "/availability", label: "Availability", short: "Hours", icon: Clock },
  { href: "/settings/profile", label: "Settings", short: "Settings", icon: Settings },
] as const;

/** Sub-navigation inside the Settings area (rendered as tabs by the settings layout). */
export const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/preferences", label: "Preferences" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/calendars", label: "Calendars" },
] as const;
