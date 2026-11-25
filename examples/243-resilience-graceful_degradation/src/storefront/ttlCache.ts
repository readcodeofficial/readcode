export class TtlCache<V> {
    private readonly entries = new Map<string, { value: V; expiresAt: number }>();
    private readonly now: () => number;

    constructor(now: () => number) {
        this.now = now;
    }

    get(key: string): V | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: V, ttlMs: number): void {
        this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    }
}
