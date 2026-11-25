import { InvalidTokenError, type SessionManager } from "./sessions.ts";
import { verifyAccessToken, type AccessClaims } from "./tokens.ts";

export interface Res {
    status: number;
    body: unknown;
}

// Token endpoints for the streaming apps (phone, TV, web player).
export function authRoutes(sessions: SessionManager, secret: string, now: () => number) {
    return {
        // POST /oauth/token { grant_type: "refresh_token", refresh_token }
        async token(body: { grant_type?: string; refresh_token?: string }): Promise<Res> {
            if (body.grant_type !== "refresh_token" || !body.refresh_token) return { status: 400, body: { error: "invalid_request" } };
            try {
                const pair = await sessions.refresh(body.refresh_token);
                return { status: 200, body: { access_token: pair.accessToken, refresh_token: pair.refreshToken, token_type: "Bearer" } };
            } catch (err) {
                if (err instanceof InvalidTokenError) return { status: 401, body: { error: "invalid_grant" } };
                throw err;
            }
        },

        // POST /logout { refresh_token }
        async logout(body: { refresh_token?: string }): Promise<Res> {
            if (body.refresh_token) await sessions.logout(body.refresh_token);
            return { status: 204, body: undefined };
        },

        // Middleware for the catalogue and playback APIs.
        authenticate(authorization: string | undefined): AccessClaims | null {
            if (!authorization?.startsWith("Bearer ")) return null;
            return verifyAccessToken(authorization.slice("Bearer ".length), secret, now());
        },
    };
}
