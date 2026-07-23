import { eq, getDb, schema } from "@dayotter/db";
import { APPS, type ConnectionState, isConfigured, isConnected } from "./registry";

export interface AppStatus {
  /** The deployment has the env this app needs (else: "Not configured"). */
  configured: boolean;
  /** This user has connected it. */
  connected: boolean;
}

/**
 * Resolve every app's status for one user in a fixed number of queries (one per
 * connection store), rather than per-app lookups. Returns a map keyed by app id
 * so the app store can render straight from the registry.
 */
export async function resolveAppStatuses(userId: string): Promise<Record<string, AppStatus>> {
  const db = getDb();
  const [calendars, crm, conferencing, user] = await Promise.all([
    db.query.calendarConnections.findMany({
      where: eq(schema.calendarConnections.userId, userId),
      columns: { provider: true },
    }),
    db.query.crmConnections.findMany({
      where: eq(schema.crmConnections.userId, userId),
      columns: { provider: true },
    }),
    db.query.conferencingConnections.findMany({
      where: eq(schema.conferencingConnections.userId, userId),
      columns: { provider: true },
    }),
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { stripeAccountId: true },
    }),
  ]);

  const state: ConnectionState = {
    calendars: new Set(calendars.map((c) => c.provider)),
    crm: new Set(crm.map((c) => c.provider)),
    conferencing: new Set(conferencing.map((c) => c.provider)),
    stripe: Boolean(user?.stripeAccountId),
  };

  const out: Record<string, AppStatus> = {};
  for (const app of APPS) {
    out[app.id] = { configured: isConfigured(app), connected: isConnected(app, state) };
  }
  return out;
}
