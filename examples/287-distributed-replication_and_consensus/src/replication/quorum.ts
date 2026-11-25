import { isNewer, type Replica, type Versioned } from "./replica.ts";

export class QuorumError extends Error {
    constructor(op: string, needed: number, reachable: number) {
        super(`${op}: needed ${needed} replicas, only ${reachable} reachable`);
        this.name = "QuorumError";
    }
}

export interface QuorumOptions {
    w: number; // replicas that must acknowledge a write
    r: number; // replicas that must answer a read; w + r > n makes every read overlap the last write
    nodeId: string; // this coordinator, used to break version ties
    clock: () => number;
}

interface Reply<T> {
    replica: Replica<T>;
    entry: Versioned<T> | null;
}

// Leaderless replicated key-value store (Dynamo style): every replica takes writes, and
// the coordinator waits for W acks on write and R answers on read.
export class QuorumStore<T> {
    private readonly replicas: Replica<T>[];
    private readonly opts: QuorumOptions;

    constructor(replicas: Replica<T>[], opts: QuorumOptions) {
        if (opts.w + opts.r <= replicas.length) throw new Error("w + r must exceed the number of replicas");
        this.replicas = replicas;
        this.opts = opts;
    }

    async put(key: string, value: T): Promise<Versioned<T>> {
        const entry: Versioned<T> = { value, version: this.opts.clock(), writer: this.opts.nodeId };
        const { w } = this.opts;
        await new Promise<void>((resolve, reject) => {
            let acks = 0;
            let failed = 0;
            for (const replica of this.replicas) {
                replica.write(key, entry).then(
                    () => {
                        if (++acks === w) resolve();
                    },
                    () => {
                        if (this.replicas.length - ++failed < w) reject(new QuorumError(`write ${key}`, w, this.replicas.length - failed));
                    },
                );
            }
        });
        return entry;
    }

    async get(key: string): Promise<T | null> {
        const { r } = this.opts;
        const replies = await new Promise<Reply<T>[]>((resolve, reject) => {
            const got: Reply<T>[] = [];
            for (const replica of this.replicas) {
                replica.read(key).then(
                    (entry) => {
                        got.push({ replica, entry });
                        if (got.length === r) resolve(got.slice());
                    },
                    () => {
                        got.push({ replica, entry: null });
                        if (got.length === r) resolve(got.slice());
                    },
                );
            }
        });

        let latest: Versioned<T> | null = null;
        for (const { entry } of replies) if (entry && isNewer(entry, latest)) latest = entry;
        if (latest === null) return null;

        // Read repair: push the newest value to the replicas that answered with something older.
        for (const { replica, entry } of replies) {
            if (entry === null || isNewer(latest, entry)) replica.write(key, latest).catch(() => undefined);
        }
        return latest.value;
    }
}
