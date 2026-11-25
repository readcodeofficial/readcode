import type { loginService } from "./login.ts";

export interface HttpResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}

// POST /login { username, password }
export function loginHandler(service: ReturnType<typeof loginService>) {
    return async function handle(body: unknown): Promise<HttpResponse> {
        const { username, password } = (body ?? {}) as Record<string, unknown>;
        if (typeof username !== "string" || typeof password !== "string" || username.trim() === "") {
            return { status: 400, headers: {}, body: { error: "username and password are required" } };
        }

        const result = await service.login(username, password);
        if (result.ok) {
            return {
                status: 200,
                headers: { "Set-Cookie": `sid=${result.sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/` },
                body: { employeeId: result.employeeId },
            };
        }
        if (result.reason === "locked") {
            const seconds = Math.ceil(result.retryAfterMs / 1000);
            return { status: 429, headers: { "Retry-After": String(seconds) }, body: { error: "too many attempts, try again later" } };
        }
        // Same answer for "no such user" and "wrong password".
        return { status: 401, headers: {}, body: { error: "invalid username or password" } };
    };
}
