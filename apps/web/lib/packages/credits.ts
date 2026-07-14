import { and, eq, getDb, schema, sql } from "@dayotter/db";

/**
 * Prepaid session packages: a host sells a bundle of N sessions for an event
 * type; each booking spends one credit. Everything here keys off the client's
 * email (the identity we have at booking time) + the event type.
 */

/** Total remaining credits a client has for an event type (sum of balances). */
export async function creditBalance(eventTypeId: string, clientEmail: string): Promise<number> {
  const [row] = await getDb()
    .select({
      remaining: sql<number>`coalesce(sum(${schema.packageCredits.totalCredits} - ${schema.packageCredits.usedCredits}), 0)`,
    })
    .from(schema.packageCredits)
    .where(
      and(
        eq(schema.packageCredits.eventTypeId, eventTypeId),
        eq(schema.packageCredits.clientEmail, clientEmail.toLowerCase()),
      ),
    );
  return Number(row?.remaining ?? 0);
}

/**
 * Atomically spend one credit for a client's event type, oldest grant first.
 * Returns true if a credit was consumed, false if they had none left. Safe
 * against concurrent bookings - the decrement is a single conditional UPDATE.
 */
export async function consumeCredit(eventTypeId: string, clientEmail: string): Promise<boolean> {
  const email = clientEmail.toLowerCase();
  const updated = await getDb().execute(sql`
    UPDATE ${schema.packageCredits}
    SET used_credits = used_credits + 1, updated_at = now()
    WHERE id = (
      SELECT id FROM ${schema.packageCredits}
      WHERE event_type_id = ${eventTypeId}
        AND client_email = ${email}
        AND used_credits < total_credits
      ORDER BY created_at ASC
      LIMIT 1
    )
    RETURNING id
  `);
  return (updated.rows?.length ?? 0) > 0;
}

/**
 * Grant a client credits (from a completed purchase or a manual host grant).
 * Idempotent on `stripePaymentIntentId` so webhook retries don't double-grant.
 */
export async function grantCredits(input: {
  organizationId: string;
  eventTypeId: string;
  clientEmail: string;
  totalCredits: number;
  packageId?: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<void> {
  const db = getDb();
  if (input.stripePaymentIntentId) {
    const existing = await db.query.packageCredits.findFirst({
      where: eq(schema.packageCredits.stripePaymentIntentId, input.stripePaymentIntentId),
      columns: { id: true },
    });
    if (existing) return; // already granted for this payment
  }
  await db.insert(schema.packageCredits).values({
    organizationId: input.organizationId,
    eventTypeId: input.eventTypeId,
    clientEmail: input.clientEmail.toLowerCase(),
    totalCredits: input.totalCredits,
    packageId: input.packageId ?? null,
    stripePaymentIntentId: input.stripePaymentIntentId ?? null,
  });
}
