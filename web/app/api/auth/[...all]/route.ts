// Better Auth's endpoints: sign-in, sign-up, sign-out, OAuth callbacks, session.
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
