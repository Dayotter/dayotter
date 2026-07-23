import { TwoFactorManager } from "@/components/two-factor-manager";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

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
    </>
  );
}
