import { createHmac, timingSafeEqual } from "node:crypto";

export function sign(secret, timestamp, body) {
    return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function signatureHeader(timestamp, signature) {
    return `t=${timestamp},v1=${signature}`;
}

// What a subscriber runs on receipt: reject stale timestamps (replay) and forged signatures.
export function verify({ secret, header, body, nowSeconds, toleranceSeconds = 300 }) {
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
    const timestamp = Number(parts.t);
    if (!Number.isFinite(timestamp)) return { ok: false, reason: "malformed" };
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return { ok: false, reason: "stale" };
    const expected = Buffer.from(sign(secret, timestamp, body));
    const given = Buffer.from(parts.v1 ?? "");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
        return { ok: false, reason: "bad signature" };
    }
    return { ok: true };
}
