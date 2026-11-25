import { setImmediate as tick } from "node:timers/promises";

// In-memory multi-version key/value store with transactions.
//
// Isolation levels:
// - "snapshot" (default): a transaction reads the data as it was committed when it began, plus
//   its own writes. Commit fails if another transaction that committed after it began wrote
//   any key this transaction also writes.
// - "serializable": like snapshot, and commit also fails if anything this transaction read
//   (keys it got, and key prefixes it scanned) was written by such a transaction.
// A failed commit throws SerializationError; Store.transaction retries the whole function.
export type Isolation = "snapshot" | "serializable";

export class SerializationError extends Error {
    constructor(key: string) {
        super(`could not serialize access due to concurrent update of ${key}`);
        this.name = "SerializationError";
    }
}

type Versions = { seq: number; value: unknown }[];

export class Transaction {
    readonly startSeq: number;
    readonly reads = new Set<string>();
    readonly scanned: string[] = [];
    readonly writes = new Map<string, unknown>();
    private readonly data: Map<string, Versions>;

    constructor(data: Map<string, Versions>, startSeq: number) {
        this.data = data;
        this.startSeq = startSeq;
    }

    private visible(key: string): unknown {
        if (this.writes.has(key)) return this.writes.get(key);
        const versions = this.data.get(key) ?? [];
        for (let i = versions.length - 1; i >= 0; i--) if (versions[i].seq <= this.startSeq) return versions[i].value;
        return undefined;
    }

    async get<T>(key: string): Promise<T | undefined> {
        await tick();
        this.reads.add(key);
        return this.visible(key) as T | undefined;
    }

    async scan<T>(prefix: string): Promise<[string, T][]> {
        await tick();
        this.scanned.push(prefix);
        const keys = new Set([...this.data.keys(), ...this.writes.keys()].filter((k) => k.startsWith(prefix)));
        return [...keys].sort().flatMap((k) => (this.visible(k) === undefined ? [] : [[k, this.visible(k) as T]]));
    }

    put(key: string, value: unknown): void {
        this.writes.set(key, value);
    }
}

export class Store {
    private readonly data = new Map<string, Versions>();
    private readonly log: { seq: number; keys: string[] }[] = [];
    private seq = 0;
    attempts = 0; // transaction attempts, including retries

    async transaction<T>(fn: (tx: Transaction) => Promise<T>, opts: { isolation?: Isolation; maxAttempts?: number } = {}): Promise<T> {
        const maxAttempts = opts.maxAttempts ?? 5;
        for (let attempt = 1; ; attempt++) {
            this.attempts++;
            const tx = new Transaction(this.data, this.seq);
            const result = await fn(tx);
            await tick();
            try {
                this.commit(tx, opts.isolation ?? "snapshot");
                return result;
            } catch (err) {
                if (!(err instanceof SerializationError) || attempt >= maxAttempts) throw err;
            }
        }
    }

    private commit(tx: Transaction, isolation: Isolation): void {
        for (const entry of this.log) {
            if (entry.seq <= tx.startSeq) continue;
            for (const key of entry.keys) {
                const touched =
                    tx.writes.has(key) ||
                    (isolation === "serializable" && (tx.reads.has(key) || tx.scanned.some((p) => key.startsWith(p))));
                if (touched) throw new SerializationError(key);
            }
        }
        if (tx.writes.size === 0) return;
        const seq = ++this.seq;
        for (const [key, value] of tx.writes) {
            if (!this.data.has(key)) this.data.set(key, []);
            this.data.get(key)!.push({ seq, value });
        }
        this.log.push({ seq, keys: [...tx.writes.keys()] });
    }
}
