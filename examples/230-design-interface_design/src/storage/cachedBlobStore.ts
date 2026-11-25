import type { BlobStore } from "./blobStore.ts";

// Read-through cache in front of any BlobStore. It is itself a BlobStore, so callers
// can't tell whether they have the cached or the plain store.
// Only hits are cached: a missing key may be uploaded by another server at any time.
export class CachedBlobStore implements BlobStore {
    private readonly inner: BlobStore;
    private readonly maxEntries: number;
    private readonly entries = new Map<string, Buffer>(); // insertion order = least recently used first

    constructor(inner: BlobStore, maxEntries = 100) {
        this.inner = inner;
        this.maxEntries = maxEntries;
    }

    async get(key: string): Promise<Buffer | null> {
        const cached = this.entries.get(key);
        if (cached) {
            this.entries.delete(key);
            this.entries.set(key, cached); // mark as recently used
            return Buffer.from(cached);
        }
        const blob = await this.inner.get(key); // errors propagate unchanged
        if (blob) this.remember(key, blob);
        return blob;
    }

    async put(key: string, data: Buffer): Promise<void> {
        await this.inner.put(key, data);
        this.remember(key, data);
    }

    async delete(key: string): Promise<void> {
        await this.inner.delete(key);
        this.entries.delete(key);
    }

    get size(): number {
        return this.entries.size;
    }

    private remember(key: string, data: Buffer): void {
        this.entries.delete(key);
        this.entries.set(key, Buffer.from(data));
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value as string;
            this.entries.delete(oldest);
        }
    }
}
