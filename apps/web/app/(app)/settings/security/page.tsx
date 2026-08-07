import { TwoFactorManager } from "@/components/two-factor-manager";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { and, asc, desc, eq, getDb, schema } from "@dayotter/db";
import { DateTime } from "luxon";

export const dynamic = "force-dynamic";

const GUARDRAIL_SOURCE_LABEL: Record<string, string> = {
  chat: "the assistant chat",
  "booking-assistant": "the booking assistant",
  voice: "the voice receptionist",
};

export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session?.user) return null; // the (app) layout redirects; this guards the render race

  const db = getDb();
  const [user, credential] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, session.user.id),
      columns: { twoFactorEnabled: true },
    }),
    // Email/password accounts have a `credential` provider row; 2FA needs one.
    db.query.accounts.findFirst({
      where: and(
        eq(schema.accounts.userId, session.user.id),
        eq(schema.accounts.providerId, "credential"),
      ),
      columns: { id: true },
    }),
  ]);

  // The assistant security log is org-scoped; owners/admins see it. Resolve the
  // caller's primary org + role, then pull the recent guardrail hits for it.
  const membership = await db.query.memberships.findFirst({
    where: eq(schema.memberships.userId, session.user.id),
    orderBy: asc(schema.memberships.createdAt),
    columns: { organizationId: true, role: true },
  });
  const canSeeLog = Boolean(membership && membership.role !== "member");
  const guardrailEvents = canSeeLog
    ? await db.query.guardrailEvents.findMany({
        where: eq(schema.guardrailEvents.organizationId, membership!.organizationId),
        orderBy: desc(schema.guardrailEvents.createdAt),
        limit: 20,
      })
    : [];

  return (
    <>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Add a second step at sign-in to keep your account safe.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Two-factor authentication"
          description="An authenticator-app code at sign-in, plus one-time recovery codes."
        />
        <CardBody>
          {credential ? (
            <TwoFactorManager enabled={Boolean(user?.twoFactorEnabled)} />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Two-factor auth needs a password on your account. You're signed in with Google or a
              phone number - set a password first (use <strong>Forgot password</strong> on the
              sign-in page) to enable 2FA.
            </p>
          )}
        </CardBody>
      </Card>

      {canSeeLog ? (
        <Card className="mt-6">
          <CardHeader
            title="Assistant security log"
            description="When Otter blocks a suspicious or injection-style request, it's refused automatically, recorded here, and the workspace owner gets an email."
          />
          <CardBody>
            {guardrailEvents.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">
                Nothing flagged. Otter hasn't had to block any requests.
              </p>
            ) : (
              <ul className="space-y-2">
                {guardrailEvents.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-md border border-[var(--color-border)] px-4 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">
                        Blocked in {GUARDRAIL_SOURCE_LABEL[e.source] ?? "the assistant"}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--color-muted)]">
                        {DateTime.fromJSDate(e.createdAt).toFormat("LLL d, h:mm a")}
                      </span>
                    </div>
                    {e.sample ? (
                      <p className="mt-1 truncate text-xs text-[var(--color-faint)]">"{e.sample}"</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
