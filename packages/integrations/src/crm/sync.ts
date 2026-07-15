import { decryptJson, encryptJson, logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { HubspotAdapter, exchangeHubspotCode, hubspotAuthUrl, hubspotEnabled } from "./hubspot";
import {
  SalesforceAdapter,
  exchangeSalesforceCode,
  salesforceAuthUrl,
  salesforceEnabled,
} from "./salesforce";
import {
  CRM_PROVIDERS,
  type CrmAccount,
  type CrmAdapter,
  type CrmCredentials,
  type CrmProvider,
} from "./types";

type CrmConnectionRow = typeof schema.crmConnections.$inferSelect;

/** Which CRM providers are configured (client id + secret present) in this deploy. */
export function crmEnabledProviders(): CrmProvider[] {
  const enabled: CrmProvider[] = [];
  if (salesforceEnabled()) enabled.push("salesforce");
  if (hubspotEnabled()) enabled.push("hubspot");
  return enabled;
}

export function isCrmProvider(value: string): value is CrmProvider {
  return (CRM_PROVIDERS as string[]).includes(value);
}

/** The provider consent URL to redirect the host to (state is a signed anti-CSRF token). */
export function crmAuthUrl(provider: CrmProvider, state: string): string {
  return provider === "salesforce" ? salesforceAuthUrl(state) : hubspotAuthUrl(state);
}

/** Exchange an OAuth code for tokens + the connected account identity. */
export function exchangeCrmCode(
  provider: CrmProvider,
  code: string,
): Promise<{ credentials: CrmCredentials; account: CrmAccount }> {
  return provider === "salesforce" ? exchangeSalesforceCode(code) : exchangeHubspotCode(code);
}

/** Persist a connection (idempotent per user+provider), storing tokens encrypted. */
export async function connectCrm(
  userId: string,
  provider: CrmProvider,
  credentials: CrmCredentials,
  account: CrmAccount,
): Promise<void> {
  const db = getDb();
  await db
    .insert(schema.crmConnections)
    .values({
      userId,
      provider,
      externalAccountId: account.externalAccountId,
      accountLabel: account.label,
      credentials: encryptJson(credentials),
      status: "active",
      lastError: null,
    })
    .onConflictDoUpdate({
      target: [schema.crmConnections.userId, schema.crmConnections.provider],
      set: {
        externalAccountId: account.externalAccountId,
        accountLabel: account.label,
        credentials: encryptJson(credentials),
        status: "active",
        lastError: null,
      },
    });
}

/** Build a live adapter from a stored connection; persists rotated tokens. */
export function adapterForCrmConnection(connection: CrmConnectionRow): CrmAdapter {
  const creds = decryptJson<CrmCredentials>(connection.credentials);
  const persist = async (next: CrmCredentials) => {
    await getDb()
      .update(schema.crmConnections)
      .set({ credentials: encryptJson(next) })
      .where(eq(schema.crmConnections.id, connection.id));
  };
  if (connection.provider === "salesforce") return new SalesforceAdapter(creds, persist);
  if (connection.provider === "hubspot") return new HubspotAdapter(creds, persist);
  throw new Error(`Unsupported CRM provider: ${connection.provider}`);
}

/**
 * Push a booking lifecycle change to every active CRM connection the host holds:
 * find-or-create the guest as a contact and log the meeting as an activity, so a
 * reschedule updates the same activity and a cancel closes it. Best-effort per
 * connection; a failing connection records `lastError` and the job retries.
 */
export async function syncBookingToCrm(
  bookingId: string,
  action: "created" | "rescheduled" | "cancelled",
): Promise<void> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.id, bookingId),
    columns: { id: true, hostId: true, title: true, startsAt: true, endsAt: true },
    with: {
      attendees: { columns: { name: true, email: true } },
      eventType: { columns: { title: true } },
      host: { columns: { email: true, name: true } },
    },
  });
  if (!booking) return;

  const connections = await db.query.crmConnections.findMany({
    where: and(
      eq(schema.crmConnections.userId, booking.hostId),
      eq(schema.crmConnections.status, "active"),
    ),
  });
  if (connections.length === 0) return;

  // The guest to log against: the first attendee who isn't the host.
  const hostEmail = booking.host?.email?.toLowerCase();
  const guest =
    booking.attendees.find((a) => a.email.toLowerCase() !== hostEmail) ?? booking.attendees[0];
  if (!guest) return; // nothing to attribute the meeting to

  const title = booking.title || booking.eventType?.title || "Meeting";
  const meetingBase = {
    title,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    description: `Booked via DayOtter${booking.host?.name ? ` with ${booking.host.name}` : ""}.`,
  };

  // Load all of this booking's references once, then index by connection
  // (was a findFirst per connection).
  const allRefs = await db.query.crmReferences.findMany({
    where: eq(schema.crmReferences.bookingId, booking.id),
  });
  const refByConn = new Map(allRefs.map((r) => [r.connectionId, r]));

  const errors: string[] = [];
  for (const conn of connections) {
    try {
      const adapter = adapterForCrmConnection(conn);
      const ref = refByConn.get(conn.id);

      if (action === "cancelled") {
        if (ref?.externalActivityId) await adapter.cancelMeeting(ref.externalActivityId);
        await clearError(conn.id);
        continue;
      }

      const contactId =
        ref?.externalContactId ??
        (await adapter.upsertContact({
          email: guest.email,
          name: guest.name ?? undefined,
        }));
      // Persist the contact id early so a mid-way failure doesn't re-create it.
      await upsertReference(conn, booking.id, { externalContactId: contactId });

      const meeting = { ...meetingBase, contactExternalId: contactId };
      let activityId = ref?.externalActivityId ?? null;
      if (activityId) {
        await adapter.updateMeeting(activityId, meeting);
      } else {
        activityId = await adapter.logMeeting(meeting);
      }
      await upsertReference(conn, booking.id, {
        externalContactId: contactId,
        externalActivityId: activityId,
      });
      await clearError(conn.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${conn.provider}: ${message}`);
      await db
        .update(schema.crmConnections)
        .set({ lastError: message })
        .where(eq(schema.crmConnections.id, conn.id))
        .catch(() => {});
      logger.error("crm sync failed for connection", {
        event: "crm_sync_connection_failed",
        connectionId: conn.id,
        provider: conn.provider,
        bookingId,
        action,
        err,
      });
    }
  }

  // Surface a failure so BullMQ retries with backoff (idempotent on re-run).
  if (errors.length > 0) throw new Error(`CRM sync had ${errors.length} failure(s)`);
}

async function upsertReference(
  conn: CrmConnectionRow,
  bookingId: string,
  fields: { externalContactId?: string; externalActivityId?: string },
): Promise<void> {
  await getDb()
    .insert(schema.crmReferences)
    .values({
      bookingId,
      connectionId: conn.id,
      provider: conn.provider,
      externalContactId: fields.externalContactId ?? null,
      externalActivityId: fields.externalActivityId ?? null,
    })
    .onConflictDoUpdate({
      target: [schema.crmReferences.bookingId, schema.crmReferences.connectionId],
      set: {
        ...(fields.externalContactId ? { externalContactId: fields.externalContactId } : {}),
        ...(fields.externalActivityId ? { externalActivityId: fields.externalActivityId } : {}),
      },
    });
}

async function clearError(connectionId: string): Promise<void> {
  await getDb()
    .update(schema.crmConnections)
    .set({ lastError: null })
    .where(eq(schema.crmConnections.id, connectionId))
    .catch(() => {});
}
