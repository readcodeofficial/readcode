import { randomBytes } from "node:crypto";

export function newSessionId(bytes = randomBytes) {
    return bytes(32).toString("base64url");
}

export function parseCookies(header) {
    const out = {};
    for (const part of (header ?? "").split(";")) {
        const i = part.indexOf("=");
        if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return out;
}

export function sessionCookie(id, maxAgeSeconds) {
    return `sid=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}
