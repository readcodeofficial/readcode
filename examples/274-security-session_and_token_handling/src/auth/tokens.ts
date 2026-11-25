import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Refresh tokens are opaque random strings; only their SHA-256 is stored server-side.
export const newRefreshToken = (): string => randomBytes(32).toString("base64url");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export interface AccessClaims {
    sub: string; // user id
    sid: string; // session (device) id
    exp: number; // ms since epoch
}

// Short-lived signed access token: base64url(JSON claims) "." base64url(HMAC-SHA256).
export function signAccessToken(claims: AccessClaims, secret: string): string {
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    return `${payload}.${sig}`;
}

export function verifyAccessToken(token: string, secret: string, now: number): AccessClaims | null {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessClaims;
    return claims.exp > now ? claims : null;
}
