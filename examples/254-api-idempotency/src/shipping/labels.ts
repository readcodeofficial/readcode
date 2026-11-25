import { runIdempotent } from "./idempotency.ts";
import type { IdempotencyStore, Response } from "./store.ts";

export interface LabelRequest {
    fromZip: string;
    toZip: string;
    weightGrams: number;
    service: "ground" | "express";
}

export interface Carrier {
    // Buys a postage label. Every call is billed to us by the carrier.
    buyLabel(req: LabelRequest): Promise<{ trackingNumber: string; costCents: number }>;
}

export interface Accounts {
    charge(accountId: string, cents: number): Promise<void>;
}

export interface HttpRequest {
    accountId: string; // from the authenticated API token
    headers: Record<string, string | undefined>;
    body: unknown;
}

function parseLabelRequest(body: unknown): LabelRequest | string {
    const b = (body ?? {}) as Record<string, unknown>;
    for (const zip of ["fromZip", "toZip"]) {
        if (typeof b[zip] !== "string" || !/^\d{5}$/.test(b[zip] as string)) return `${zip} must be a 5-digit ZIP code`;
    }
    if (!Number.isInteger(b.weightGrams) || (b.weightGrams as number) <= 0 || (b.weightGrams as number) > 70_000) return "weightGrams must be 1 to 70000";
    if (b.service !== "ground" && b.service !== "express") return "service must be ground or express";
    return b as unknown as LabelRequest;
}

// POST /labels. Merchants' warehouse scanners retry on any timeout, so every request must
// carry an Idempotency-Key; a repeat must never buy (or bill) a second label.
export function labelsEndpoint(carrier: Carrier, accounts: Accounts, keys: IdempotencyStore, now: () => number) {
    return async function postLabel(req: HttpRequest): Promise<Response> {
        const key = req.headers["idempotency-key"];
        if (!key || key.length > 128) return { status: 400, body: { error: "Idempotency-Key header is required" } };
        const parsed = parseLabelRequest(req.body);
        if (typeof parsed === "string") return { status: 400, body: { error: parsed } };

        return runIdempotent(keys, now, req.accountId, key, req.body, async () => {
            let label;
            try {
                label = await carrier.buyLabel(parsed);
            } catch {
                return { status: 502, body: { error: "carrier unavailable, retry with the same Idempotency-Key" } };
            }
            await accounts.charge(req.accountId, label.costCents);
            return { status: 201, body: { trackingNumber: label.trackingNumber, costCents: label.costCents } };
        });
    };
}
