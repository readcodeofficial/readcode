import { setImmediate as tick } from "node:timers/promises";

// A value as stored on a replica. Last write wins: higher version, then higher writer id on a tie.
export interface Versioned<T> {
    value: T;
    version: number;
    writer: string;
}

export interface Replica<T> {
    readonly id: string;
    read(key: string): Promise<Versioned<T> | null>;
    write(key: string, entry: Versioned<T>): Promise<void>;
}

export function isNewer<T>(a: Versioned<T>, b: Versioned<T> | null): boolean {
    if (b === null) return true;
    return a.version !== b.version ? a.version > b.version : a.writer > b.writer;
}

export class ReplicaDownError extends Error {
    constructor(id: string) {
        super(`replica ${id} is unreachable`);
        this.name = "ReplicaDownError";
    }
}

// In-process replica used by the simulator and local development. `latency` is how many
// event-loop turns a request takes; `up = false` makes every request fail like a dead node.
export class MemoryReplica<T> implements Replica<T> {
    readonly id: string;
    latency: number;
    up = true;
    private readonly data = new Map<string, Versioned<T>>();

    constructor(id: string, latency = 0) {
        this.id = id;
        this.latency = latency;
    }

    private async roundTrip(): Promise<void> {
        for (let i = 0; i < this.latency; i++) await tick();
        if (!this.up) throw new ReplicaDownError(this.id);
    }

    async read(key: string): Promise<Versioned<T> | null> {
        await this.roundTrip();
        return this.data.get(key) ?? null;
    }

    async write(key: string, entry: Versioned<T>): Promise<void> {
        await this.roundTrip();
        if (isNewer(entry, this.data.get(key) ?? null)) this.data.set(key, entry);
    }

    // What this replica holds right now, without a round trip (for operators and tests).
    peek(key: string): Versioned<T> | null {
        return this.data.get(key) ?? null;
    }
}
