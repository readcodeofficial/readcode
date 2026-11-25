export interface Response {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface IdempotencyRecord {
    state: "in_progress" | "done";
    fingerprint: string; // hash of the request body the key was first used with
    createdAt: number;
    response?: Response;
}

// Shared across all API instances (a table with a unique key in production).
export interface IdempotencyStore {
    get(key: string): Promise<IdempotencyRecord | undefined>;
    create(key: string, record: IdempotencyRecord): Promise<boolean>; // false if the key already exists
    update(key: string, record: IdempotencyRecord): Promise<void>;
    delete(key: string): Promise<void>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
    readonly records = new Map<string, IdempotencyRecord>();

    async get(key: string) {
        const r = this.records.get(key);
        return r && structuredClone(r);
    }

    async create(key: string, record: IdempotencyRecord) {
        if (this.records.has(key)) return false;
        this.records.set(key, structuredClone(record));
        return true;
    }

    async update(key: string, record: IdempotencyRecord) {
        if (!this.records.has(key)) throw new Error(`no idempotency record ${key}`);
        this.records.set(key, structuredClone(record));
    }

    async delete(key: string) {
        this.records.delete(key);
    }
}
