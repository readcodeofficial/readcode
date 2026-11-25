import { createHash } from "node:crypto";
import type { IdempotencyRecord, IdempotencyStore, Response } from "./store.ts";

export const KEY_TTL_MS = 24 * 3600_000;

const fingerprintOf = (body: unknown) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

function replay(record: IdempotencyRecord, fingerprint: string): Response {
    if (record.fingerprint !== fingerprint) {
        return { status: 422, body: { error: "Idempotency-Key was already used with a different request body" } };
    }
    if (record.state === "in_progress") {
        return { status: 409, headers: { "Retry-After": "1" }, body: { error: "A request with this Idempotency-Key is still being processed" } };
    }
    const saved = record.response as Response;
    return { ...saved, headers: { ...saved.headers, "Idempotent-Replayed": "true" } };
}

// Runs `work` at most once per (scope, key). Repeats of a finished request get the saved
// response back. Server errors aren't saved, so the client can retry with the same key.
export async function runIdempotent(
    store: IdempotencyStore,
    now: () => number,
    scope: string,
    key: string,
    body: unknown,
    work: () => Promise<Response>,
): Promise<Response> {
    const storeKey = `${scope}:${key}`;
    const fingerprint = fingerprintOf(body);

    let existing = await store.get(storeKey);
    if (existing && now() - existing.createdAt >= KEY_TTL_MS) {
        await store.delete(storeKey);
        existing = undefined;
    }
    if (existing) return replay(existing, fingerprint);

    const response = await work();
    if (response.status < 500) {
        await store.create(storeKey, { state: "done", fingerprint, createdAt: now(), response });
    }
    return response;
}
