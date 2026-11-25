import type { PriceSource } from "./quoteCart.ts";

// Wraps the price service with a short-lived cache. Concurrent lookups of the same SKU
// share one request instead of each hitting the service.
export class CachedPriceSource implements PriceSource {
    private readonly inner: PriceSource;
    private readonly ttlMs: number;
    private readonly now: () => number;
    private readonly cache = new Map<string, { priceCents: number; expiresAt: number }>();
    private readonly inFlight = new Map<string, Promise<number>>();

    constructor(inner: PriceSource, ttlMs: number, now: () => number = Date.now) {
        this.inner = inner;
        this.ttlMs = ttlMs;
        this.now = now;
    }

    async fetchPriceCents(sku: string): Promise<number> {
        const hit = this.cache.get(sku);
        if (hit && hit.expiresAt > this.now()) return hit.priceCents;

        const pending = this.inFlight.get(sku);
        if (pending) return pending;

        const request = this.inner
            .fetchPriceCents(sku)
            .then((priceCents) => {
                this.cache.set(sku, { priceCents, expiresAt: this.now() + this.ttlMs });
                return priceCents;
            })
            .finally(() => this.inFlight.delete(sku)); // failures are not cached
        this.inFlight.set(sku, request);
        return request;
    }
}
