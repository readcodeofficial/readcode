import { PublishTimeoutError, type InMemoryBroker } from "../queue/broker.ts";

export interface Purchase {
    orderId: string;
    memberId: string;
    amountCents: number;
}

// Checkout publishes one PurchaseCompleted event per order. A timeout doesn't mean the broker
// didn't get it, so retries carry the same idempotency key for consumers to dedupe on.
export async function publishPurchase(broker: InMemoryBroker, purchase: Purchase, maxAttempts = 3): Promise<void> {
    const headers = { "event-type": "PurchaseCompleted", "idempotency-key": `purchase:${purchase.orderId}` };
    for (let attempt = 1; ; attempt++) {
        try {
            await broker.publish(JSON.stringify(purchase), headers);
            return;
        } catch (err) {
            if (!(err instanceof PublishTimeoutError) || attempt >= maxAttempts) throw err;
        }
    }
}

// Remembers which events were already handled, for long enough to cover redeliveries and retries.
export class DedupStore {
    private readonly seen = new Map<string, number>(); // key -> expiry (ms)
    private readonly ttlMs: number;

    constructor(ttlMs: number) {
        this.ttlMs = ttlMs;
    }

    // true if this caller is the first to claim the key (within the TTL)
    claim(key: string, nowMs: number): boolean {
        const expiry = this.seen.get(key);
        if (expiry !== undefined && expiry > nowMs) return false;
        this.seen.set(key, nowMs + this.ttlMs);
        return true;
    }

    release(key: string): void {
        this.seen.delete(key);
    }
}

export class PointsLedger {
    readonly balances = new Map<string, number>();
    failNextAwards = 0;

    async award(memberId: string, points: number): Promise<void> {
        if (this.failNextAwards > 0) {
            this.failNextAwards--;
            throw new Error("points DB unavailable");
        }
        this.balances.set(memberId, (this.balances.get(memberId) ?? 0) + points);
    }
}
