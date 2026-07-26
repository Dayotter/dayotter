/**
 * Jitsi Meet video rooms. Unlike Zoom/Meet there's no account or OAuth - a room
 * is just a URL, so we derive one per booking from its (unguessable) uid. Points
 * at the public meet.jit.si by default; a self-hoster sets JITSI_BASE_URL to
 * their own instance.
 */
export function jitsiRoomUrl(uid: string): string {
  const base = (process.env.JITSI_BASE_URL || "https://meet.jit.si").replace(/\/+$/, "");
  return `${base}/DayOtter-${uid}`;
}
