import { auth } from "@dayotter/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Mounts all Better Auth endpoints: /api/auth/sign-up, /sign-in, /sign-out,
// /organization/*, etc. Both web and mobile clients hit these.
export const { GET, POST } = toNextJsHandler(auth);
