interface Slot<V> {
    version: number;
    live: boolean; // false: invalidated at `version`, no value cached
    value?: V;
    expiresAt: number;
}

// Cache for rows that carry a version number (bumped by every write).
// Readers fill it with what they read; writers invalidate it with the version they wrote.
// The versions stop a slow reader from caching a row that a write has already replaced.
export class VersionedCache<V> {
    private readonly slots = new Map<string, Slot<V>>();
    private readonly ttlMs: number;
    private readonly now: () => number;

    constructor(ttlMs: number, now: () => number) {
        this.ttlMs = ttlMs;
        this.now = now;
    }

    private slot(key: string): Slot<V> | undefined {
        const slot = this.slots.get(key);
        if (slot && this.now() >= slot.expiresAt) {
            this.slots.delete(key);
            return undefined;
        }
        return slot;
    }

    get(key: string): { value: V; version: number } | undefined {
        const slot = this.slot(key);
        return slot?.live ? { value: slot.value as V, version: slot.version } : undefined;
    }

    // Read path. Returns false if the cache already knows about a newer version.
    fill(key: string, value: V, version: number): boolean {
        const existing = this.slot(key);
        if (existing?.live && existing.version > version) return false;
        this.slots.set(key, { version, live: true, value, expiresAt: this.now() + this.ttlMs });
        return true;
    }

    // Write path: drop the cached value but remember which version replaced it.
    invalidate(key: string, version: number): void {
        const existing = this.slot(key);
        if (existing && existing.version > version) return;
        this.slots.set(key, { version, live: false, expiresAt: this.now() + this.ttlMs });
    }
}
