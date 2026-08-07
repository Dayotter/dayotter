import { and, desc, eq, getDb, inArray, isNotNull, isNull, schema } from "@dayotter/db";
import { guardrailAlert, sendEmail } from "@dayotter/emails";
import { type GuardrailAlertJob, QUEUE_NAMES, connection } from "@dayotter/jobs";
import { Worker } from "bullmq";
import { DateTime } from "luxon";

/** One owner email per org at most this often, so a burst of probes = one note. */
const THROTTLE_MS = 60 * 60_000;

const SOURCE_LABEL: Record<string, string> = {
  chat: "the assistant chat",
  "booking-assistant": "the public booking assistant",
  voice: "the voice receptionist",
};

/**
 * Emails a workspace owner when the AI assistant blocks a suspicious request.
 * Throttled per org: if an alert already went out within THROTTLE_MS, this hit
 * is silently folded in (its row is stamped notified, no second email). One
 * email therefore "covers" every unnotified hit in the window.
 */
export function startGuardrailAlertsWorker(): Worker<GuardrailAlertJob> {
  return new Worker<GuardrailAlertJob>(
    QUEUE_NAMES.guardrailAlerts,
    async (job) => {
      const db = getDb();
      const event = await db.query.guardrailEvents.findFirst({
        where: eq(schema.guardrailEvents.id, job.data.eventId),
      });
      if (!event || event.notifiedAt) return; // gone or already handled
      const orgId = event.organizationId;
      if (!orgId) {
        // No owner to notify - just mark it handled so it doesn't re-queue.
        await stamp(db, [event.id]);
        return;
      }

      // Throttle: if this org got an alert recently, fold this hit in silently.
      const lastSent = await db.query.guardrailEvents.findFirst({
        where: and(
          eq(schema.guardrailEvents.organizationId, orgId),
          isNotNull(schema.guardrailEvents.notifiedAt),
        ),
        orderBy: desc(schema.guardrailEvents.notifiedAt),
      });
      if (lastSent?.notifiedAt && Date.now() - lastSent.notifiedAt.getTime() < THROTTLE_MS) {
        await stamp(db, [event.id]);
        return;
      }

      // Everything still unnotified for this org is covered by this one email.
      const pending = await db.query.guardrailEvents.findMany({
        where: and(
          eq(schema.guardrailEvents.organizationId, orgId),
          isNull(schema.guardrailEvents.notifiedAt),
        ),
        orderBy: desc(schema.guardrailEvents.createdAt),
      });
      if (pending.length === 0) return;
      const latest = pending[0]!;

      const owner = await db.query.memberships.findFirst({
        where: and(
          eq(schema.memberships.organizationId, orgId),
          eq(schema.memberships.role, "owner"),
        ),
        with: { user: true },
      });
      const ids = pending.map((p) => p.id);

      if (owner?.user?.email) {
        const appUrl = process.env.APP_URL ?? "http://localhost:3000";
        await sendEmail({
          ...guardrailAlert({
            ownerName: owner.user.name?.split(" ")[0] || undefined,
            sourceLabel: SOURCE_LABEL[latest.source] ?? "the assistant",
            sample: latest.sample,
            when: DateTime.fromJSDate(latest.createdAt).toFormat("ccc, LLL d 'at' h:mm a (ZZZZ)"),
            count: pending.length,
            reviewUrl: `${appUrl}/settings/security`,
          }),
          to: owner.user.email,
        }).catch(() => 0);
      }

      // Stamp all covered rows notified whether or not the email sent, so we
      // never spin retrying an org that has no reachable owner.
      await stamp(db, ids);
    },
    { connection, concurrency: 5 },
  );
}

function stamp(db: ReturnType<typeof getDb>, ids: string[]): Promise<unknown> {
  return db
    .update(schema.guardrailEvents)
    .set({ notifiedAt: new Date() })
    .where(inArray(schema.guardrailEvents.id, ids));
}
