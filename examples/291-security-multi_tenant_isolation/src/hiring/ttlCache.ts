// Small read-through cache with a fixed time-to-live. Shared by every request in the process.
export class TtlCache<V> {
    private readonly entries = new Map<string, { value: V; expiresAt: number }>();
    private readonly ttlMs: number;
    private readonly now: () => number;

    constructor(ttlMs: number, now: () => number) {
        this.ttlMs = ttlMs;
        this.now = now;
    }

    async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
        const hit = this.entries.get(key);
        if (hit && hit.expiresAt > this.now()) return hit.value;
        const value = await load();
        this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
        return value;
    }

    delete(key: string): void {
        this.entries.delete(key);
    }
}
