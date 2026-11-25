// Java-style string hash, kept because existing data was placed with it.
export function hashKey(key: string): number {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
        h = (h * 31 + key.charCodeAt(i)) | 0;
    }
    return h;
}

// Routes each key to one of a fixed list of shards.
export class ShardRouter<T> {
    private readonly shards: T[];

    constructor(shards: T[]) {
        if (shards.length === 0) throw new Error("at least one shard is required");
        this.shards = shards;
    }

    get count(): number {
        return this.shards.length;
    }

    indexFor(key: string): number {
        return hashKey(key) % this.shards.length;
    }

    shardFor(key: string): T {
        return this.shards[this.indexFor(key)];
    }

    all(): readonly T[] {
        return this.shards;
    }
}
