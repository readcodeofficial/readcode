import { userHandlers, type Request, type Response, type UserRepo } from "./handlers.ts";
import { listUsers, type UserQuery } from "./list.ts";

export interface HttpRequest {
    method: string;
    path: string;
    query: Record<string, string | undefined>;
    headers: Record<string, string | undefined>;
    rawBody: string;
}

const USER_PATH = /^\/users\/([A-Za-z0-9_-]{1,64})$/;

const methodNotAllowed = (allow: string[]): Response => ({
    status: 405,
    headers: { Allow: allow.join(", ") },
    body: { error: "method not allowed" },
});

const lowercaseKeys = (h: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));

// Maps HTTP requests onto the user handlers: method and path dispatch, JSON parsing, and the
// error responses for requests that never reach a handler.
export function makeRouter(repo: UserRepo & UserQuery, now: () => Date) {
    const users = userHandlers(repo, now);
    const byMethod: Record<string, (req: Request) => Promise<Response>> = {
        GET: users.get,
        PUT: users.put,
        PATCH: users.patch,
    };

    return async function route(req: HttpRequest): Promise<Response> {
        const headers = lowercaseKeys(req.headers);
        if (req.path === "/users") {
            return req.method === "GET" ? listUsers(repo, req.query) : methodNotAllowed(["GET"]);
        }

        const match = USER_PATH.exec(req.path);
        if (!match) return { status: 404, body: { error: "not found" } };
        if (req.method === "OPTIONS") {
            return { status: 204, headers: { Allow: [...Object.keys(byMethod), "OPTIONS"].join(", ") } };
        }
        const handler = byMethod[req.method];
        if (!handler) return methodNotAllowed(Object.keys(byMethod));

        // Conditional GET: a client that already has this version gets 304 and no body.
        if (req.method === "GET") {
            const res = await handler({ params: { id: match[1] }, headers, body: undefined });
            const etag = res.headers?.ETag;
            if (res.status === 200 && etag !== undefined && headers["if-none-match"] === etag) {
                return { status: 304, headers: { ETag: etag } };
            }
            return res;
        }

        if (!headers["content-type"]?.startsWith("application/json")) {
            return { status: 415, body: { error: "expected Content-Type: application/json" } };
        }
        let body: unknown;
        try {
            body = JSON.parse(req.rawBody);
        } catch {
            return { status: 400, body: { error: "malformed JSON body" } };
        }
        return handler({ params: { id: match[1] }, headers, body });
    };
}
