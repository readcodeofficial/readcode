interface Entry<V> {
    value: V;
    ttlMs: number;
    expiresAt: number;
}

// In-process cache with a TTL per entry and a size cap. When full, the least recently
// used entry is evicted (a Map iterates in insertion order, so the first key is the oldest).
export class TtlCache<V> {
    private readonly entries = new Map<string, Entry<V>>();
    private readonly maxEntries: number;
    private readonly now: () => number;

    constructor(maxEntries: number, now: () => number) {
        if (maxEntries < 1) throw new Error("maxEntries must be at least 1");
        this.maxEntries = maxEntries;
        this.now = now;
    }

    get(key: string): V | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (this.now() >= entry.expiresAt) {
            this.entries.delete(key);
            return undefined;
        }
        // Move to the back of the eviction order.
        this.entries.delete(key);
        entry.expiresAt = this.now() + entry.ttlMs;
        this.entries.set(key, entry);
        return entry.value;
    }

    set(key: string, value: V, ttlMs: number): void {
        if (!(ttlMs > 0)) throw new Error("ttlMs must be positive");
        this.entries.delete(key);
        this.entries.set(key, { value, ttlMs, expiresAt: this.now() + ttlMs });
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value as string;
            this.entries.delete(oldest);
        }
    }

    get size(): number {
        return this.entries.size;
    }
}
