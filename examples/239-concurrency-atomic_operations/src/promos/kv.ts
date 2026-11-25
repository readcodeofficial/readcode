// The subset of the Redis-style store the promo service uses. Every method is one round trip.
export interface KeyValueStore {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    del(key: string): Promise<void>;
    // Atomic on the server: adds delta (treating a missing key as 0) and returns the new value.
    incrBy(key: string, delta: number): Promise<number>;
    // Atomic on the server: sets the key only if it doesn't exist; true if this call set it.
    setIfAbsent(key: string, value: string): Promise<boolean>;
}
