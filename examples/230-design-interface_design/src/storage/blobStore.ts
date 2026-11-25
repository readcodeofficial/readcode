// Every BlobStore implementation follows the same contract:
// - get() resolves to null when the key does not exist, and rejects on any other failure.
// - put() creates or overwrites.
// - delete() of a key that does not exist succeeds.
export interface BlobStore {
    get(key: string): Promise<Buffer | null>;
    put(key: string, data: Buffer): Promise<void>;
    delete(key: string): Promise<void>;
}

// Used in tests and local development.
export class MemoryBlobStore implements BlobStore {
    private readonly blobs = new Map<string, Buffer>();

    async get(key: string): Promise<Buffer | null> {
        const blob = this.blobs.get(key);
        return blob ? Buffer.from(blob) : null;
    }

    async put(key: string, data: Buffer): Promise<void> {
        this.blobs.set(key, Buffer.from(data));
    }

    async delete(key: string): Promise<void> {
        this.blobs.delete(key);
    }
}
