import { auth } from "@dayotter/auth";
import { headers } from "next/headers";

/** Resolve the current session (or null) in a Server Component / route handler. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}
