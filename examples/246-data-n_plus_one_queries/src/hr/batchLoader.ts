// Collects every load() made in the same tick into one batch call, and remembers results for the
// rest of the request. Create one loader per request.
export class BatchLoader<K, V> {
    private readonly fetchMany: (keys: K[]) => Promise<Map<K, V>>;
    private readonly cache = new Map<K, Promise<V | null>>();
    private queue: { key: K; resolve: (v: V | null) => void; reject: (e: unknown) => void }[] = [];

    constructor(fetchMany: (keys: K[]) => Promise<Map<K, V>>) {
        this.fetchMany = fetchMany;
    }

    load(key: K): Promise<V | null> {
        const cached = this.cache.get(key);
        if (cached) return cached;
        const promise = new Promise<V | null>((resolve, reject) => {
            this.queue.push({ key, resolve, reject });
            if (this.queue.length === 1) queueMicrotask(() => void this.dispatch());
        });
        this.cache.set(key, promise);
        return promise;
    }

    private async dispatch(): Promise<void> {
        const batch = this.queue;
        this.queue = [];
        try {
            const found = await this.fetchMany(batch.map((b) => b.key));
            for (const b of batch) b.resolve(found.get(b.key) ?? null);
        } catch (err) {
            for (const b of batch) b.reject(err);
        }
    }
}
