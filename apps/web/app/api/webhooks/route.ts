import { requireFeature } from "@/lib/billing/require-feature";
import { jsonError, withUser } from "@/lib/server/http";
import { SsrfError, assertPublicHttpUrl, encrypt, randomToken } from "@dayotter/core";
import { asc, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const EVENTS = ["booking.created", "booking.cancelled", "booking.rescheduled"] as const;

/** List the user's webhook endpoints (secret is never returned after creation). */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.webhookEndpoints.findMany({
    where: eq(schema.webhookEndpoints.userId, u.id),
    orderBy: asc(schema.webhookEndpoints.createdAt),
  });
  return NextResponse.json({
    endpoints: rows.map((e) => ({
      id: e.id,
      url: e.url,
      events: e.events,
      disabled: e.disabledAt != null,
      createdAt: e.createdAt.toISOString(),
    })),
    availableEvents: EVENTS,
  });
});

const body = z.object({
  // HTTPS-only + no internal hosts (SSRF guard); DNS is re-checked at delivery.
  url: z
    .string()
    .url()
    .superRefine((u, ctx) => {
      try {
        assertPublicHttpUrl(u, { requireHttps: true });
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof SsrfError ? e.message : "Invalid URL",
        });
      }
    }),
  events: z
    .array(z.enum(["*", ...EVENTS]))
    .min(1)
    .default(["*"]),
});

/** Create a webhook endpoint. Returns the signing secret ONCE. */
export const POST = withUser(async (u, request) => {
  const gate = await requireFeature(u.id, "developer");
  if (gate) return gate;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid endpoint", 400);

  const secret = `whsec_${randomToken(24)}`;
  const [created] = await getDb()
    .insert(schema.webhookEndpoints)
    .values({
      userId: u.id,
      url: parsed.data.url,
      events: parsed.data.events,
      secretEncrypted: encrypt(secret),
    })
    .returning();

  return NextResponse.json({
    endpoint: {
      id: created!.id,
      url: created!.url,
      events: created!.events,
      disabled: false,
      createdAt: created!.createdAt.toISOString(),
    },
    secret,
  });
});
