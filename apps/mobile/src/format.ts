const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function time(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** e.g. "Wed, Jul 8 · 2:00 PM" in device-local time. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()} · ${time(d)}`;
}

/** e.g. "Jul 8". */
export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatTime(iso: string): string {
  return time(new Date(iso));
}
