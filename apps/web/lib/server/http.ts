import { NextResponse } from "next/server";
import { getSession } from "../auth/session";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** Standard JSON error response. */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

type AuthedHandler<Ctx> = (
  user: SessionUser,
  request: Request,
  ctx: Ctx,
) => Promise<Response> | Response;

/**
 * Wrap a route handler so it only runs for authenticated users, injecting the
 * session user. Replaces the repeated `getSession()` + 401 boilerplate.
 *
 *   export const GET = withUser(async (user) => NextResponse.json({ id: user.id }));
 */
export function withUser<Ctx = unknown>(handler: AuthedHandler<Ctx>) {
  return async (request: Request, ctx: Ctx): Promise<Response> => {
    const session = await getSession();
    if (!session?.user?.id) return jsonError("Unauthorized", 401);
    return handler(
      { id: session.user.id, email: session.user.email, name: session.user.name ?? null },
      request,
      ctx,
    );
  };
}
