// The shape of the shared cache (Redis in production).
export interface Cache<V> {
    get(key: string): Promise<V | undefined>;
    set(key: string, value: V, ttlMs: number): Promise<void>;
    delete(key: string): Promise<void>;
}

export class MemoryCache<V> implements Cache<V> {
    private readonly entries = new Map<string, { value: V; expiresAt: number }>();
    private readonly now: () => number;

    constructor(now: () => number) {
        this.now = now;
    }

    async get(key: string): Promise<V | undefined> {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (this.now() >= entry.expiresAt) {
            this.entries.delete(key);
            return undefined;
        }
        return structuredClone(entry.value);
    }

    async set(key: string, value: V, ttlMs: number): Promise<void> {
        this.entries.set(key, { value: structuredClone(value), expiresAt: this.now() + ttlMs });
    }

    async delete(key: string): Promise<void> {
        this.entries.delete(key);
    }
}
