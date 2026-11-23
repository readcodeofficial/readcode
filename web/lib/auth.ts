// Accounts and sessions (Better Auth), stored in the app database.
// Environment:
//   BETTER_AUTH_SECRET    required in production (signs session cookies); e.g. `openssl rand -base64 32`
//   BETTER_AUTH_URL       the site's URL, e.g. https://readcode.vercel.app (defaults to the request's origin)
//   GITHUB_CLIENT_ID      optional: with GITHUB_CLIENT_SECRET, enables "Continue with GitHub"
//   GITHUB_CLIENT_SECRET
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { db } from "./db";
import * as schema from "./db/schema";

export const githubEnabled = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

export const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    socialProviders: githubEnabled
        ? { github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! } }
        : {},
    plugins: [nextCookies()], // lets server actions set the session cookie
});

export type SessionUser = typeof auth.$Infer.Session.user;

// The signed-in user for the current request, or null. Reads request headers, so a page that
// calls it renders at request time (put it under <Suspense> or a loading.tsx).
export async function currentUser(): Promise<SessionUser | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user ?? null;
}
