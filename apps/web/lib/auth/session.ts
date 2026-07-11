import { auth } from "@dayotter/auth";
import { headers } from "next/headers";

/** Resolve the current session (or null) in a Server Component / route handler. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Return the authenticated user id or throw — use to gate protected routes. */
export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session?.user?.id) throw new Response("Unauthorized", { status: 401 });
  return session.user.id;
}
