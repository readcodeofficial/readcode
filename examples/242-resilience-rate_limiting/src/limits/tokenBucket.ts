export interface Clock {
    now(): number; // epoch milliseconds
}

export interface Decision {
    allowed: boolean;
    remaining: number; // whole tokens left after this request
    retryAfterMs: number; // 0 when allowed
}

interface Bucket {
    tokens: number;
    updatedAt: number;
}

// One token bucket per key: it holds up to `capacity` tokens and refills continuously at
// `refillPerSec`. A request of cost N needs N tokens.
export class TokenBucketLimiter {
    private readonly capacity: number;
    private readonly refillPerSec: number;
    private readonly clock: Clock;
    private readonly buckets = new Map<string, Bucket>();

    constructor(capacity: number, refillPerSec: number, clock: Clock) {
        if (capacity < 1 || refillPerSec <= 0) throw new Error("capacity and refill rate must be positive");
        this.capacity = capacity;
        this.refillPerSec = refillPerSec;
        this.clock = clock;
    }

    take(key: string, cost = 1): Decision {
        if (cost > this.capacity) throw new Error(`cost ${cost} exceeds bucket capacity ${this.capacity}`);
        const now = this.clock.now();
        const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updatedAt: now };

        const elapsedMs = Math.max(0, now - bucket.updatedAt);
        bucket.tokens = Math.min(this.capacity, bucket.tokens + (elapsedMs * this.refillPerSec) / 1000);
        bucket.updatedAt = now;
        this.buckets.set(key, bucket);

        bucket.tokens -= cost;
        if (bucket.tokens >= 0) {
            return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
        }
        const missing = -bucket.tokens;
        return { allowed: false, remaining: 0, retryAfterMs: Math.ceil((missing * 1000) / this.refillPerSec) };
    }
}
