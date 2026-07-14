import { logger } from "@dayotter/core";
import { decryptJson, encryptJson } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { env } from "../server/env";

/**
 * Zoom conferencing integration. Env-gated: without `ZOOM_CLIENT_ID` +
 * `ZOOM_CLIENT_SECRET` the whole feature is inert (the connect button is hidden
 * and no meetings are created). Tokens are stored encrypted, exactly like
 * calendar connections. Follows Zoom's OAuth + Meetings API.
 */
export const zoomEnabled = Boolean(env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET);

const AUTHORIZE_URL = "https://zoom.us/oauth/authorize";
const TOKEN_URL = "https://zoom.us/oauth/token";
const API = "https://api.zoom.us/v2";

interface ZoomCredentials {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  scope?: string;
}

function redirectUri(): string {
  return `${env.APP_URL}/api/integrations/zoom/callback`;
}

function basicAuth(): string {
  return Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString("base64");
}

/** The Zoom consent URL to redirect the user to (state is our signed anti-CSRF token). */
export function zoomAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.ZOOM_CLIENT_ID,
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function toCreds(token: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}): ZoomCredentials {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    // Refresh a minute early to avoid edge-of-expiry failures.
    expiresAt: Date.now() + (token.expires_in - 60) * 1000,
    scope: token.scope,
  };
}

/** Exchange an authorization code for tokens + the Zoom account identity. */
export async function exchangeZoomCode(
  code: string,
): Promise<{ credentials: ZoomCredentials; account: { id: string; email: string } }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) throw new Error(`Zoom token exchange failed (${res.status})`);
  const token = (await res.json()) as Parameters<typeof toCreds>[0];
  const credentials = toCreds(token);

  const me = await fetch(`${API}/users/me`, {
    headers: { authorization: `Bearer ${credentials.accessToken}` },
  });
  if (!me.ok) throw new Error(`Zoom profile fetch failed (${me.status})`);
  const profile = (await me.json()) as { id: string; email: string };
  return { credentials, account: { id: profile.id, email: profile.email } };
}

/** Persist (or update) the user's Zoom connection. */
export async function connectZoom(
  userId: string,
  credentials: ZoomCredentials,
  account: { id: string; email: string },
): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.conferencingConnections)
    .values({
      userId,
      provider: "zoom",
      externalAccountId: account.email || account.id,
      credentials: encryptJson(credentials),
      status: "active",
    })
    .onConflictDoUpdate({
      target: [schema.conferencingConnections.userId, schema.conferencingConnections.provider],
      set: {
        externalAccountId: account.email || account.id,
        credentials: encryptJson(credentials),
        status: "active",
        lastError: null,
      },
    });
}

/** Refresh an expired access token and persist the rotated credentials. */
async function refreshCredentials(
  connectionId: string,
  creds: ZoomCredentials,
): Promise<ZoomCredentials> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${basicAuth()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: creds.refreshToken }),
  });
  if (!res.ok) throw new Error(`Zoom token refresh failed (${res.status})`);
  const next = toCreds((await res.json()) as Parameters<typeof toCreds>[0]);
  await getDb()
    .update(schema.conferencingConnections)
    .set({ credentials: encryptJson(next) })
    .where(eq(schema.conferencingConnections.id, connectionId));
  return next;
}

/** True when the user has an active Zoom connection. */
export async function hasZoomConnection(userId: string): Promise<boolean> {
  const row = await getDb().query.conferencingConnections.findFirst({
    where: and(
      eq(schema.conferencingConnections.userId, userId),
      eq(schema.conferencingConnections.provider, "zoom"),
      eq(schema.conferencingConnections.status, "active"),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

/**
 * Create a scheduled Zoom meeting for a booking and return its join URL, or null
 * if the user has no Zoom connection or the API call fails. Best-effort - the
 * booking always proceeds (falls back to any manual link).
 */
export async function createZoomMeeting(
  userId: string,
  meeting: { topic: string; startISO: string; durationMinutes: number; timezone: string },
): Promise<string | null> {
  if (!zoomEnabled) return null;
  const db = getDb();
  const conn = await db.query.conferencingConnections.findFirst({
    where: and(
      eq(schema.conferencingConnections.userId, userId),
      eq(schema.conferencingConnections.provider, "zoom"),
      eq(schema.conferencingConnections.status, "active"),
    ),
  });
  if (!conn) return null;

  try {
    let creds = decryptJson<ZoomCredentials>(conn.credentials);
    if (Date.now() >= creds.expiresAt) creds = await refreshCredentials(conn.id, creds);

    const res = await fetch(`${API}/users/me/meetings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${creds.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        topic: meeting.topic,
        type: 2, // scheduled
        start_time: meeting.startISO,
        duration: meeting.durationMinutes,
        timezone: meeting.timezone,
        settings: { join_before_host: true, waiting_room: false },
      }),
    });
    if (!res.ok) throw new Error(`Zoom create-meeting failed (${res.status})`);
    const created = (await res.json()) as { join_url?: string };
    return created.join_url ?? null;
  } catch (err) {
    logger.error("zoom meeting create failed", { event: "zoom_meeting_failed", userId, err });
    // Mark the connection so the UI can prompt a reconnect on auth failures.
    await db
      .update(schema.conferencingConnections)
      .set({ lastError: err instanceof Error ? err.message : "error" })
      .where(eq(schema.conferencingConnections.id, conn.id))
      .catch(() => {});
    return null;
  }
}
