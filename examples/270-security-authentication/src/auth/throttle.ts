export interface ThrottleOptions {
    maxFailures: number; // failures within the window that trigger a lock
    windowMs: number;
    lockMs: number;
}

interface Entry {
    failures: number[]; // timestamps of recent failures
    lockedUntil: number;
}

// Counts failed logins per key and locks the key out after too many in a short window.
export class LoginThrottle {
    private readonly opts: ThrottleOptions;
    private readonly entries = new Map<string, Entry>();

    constructor(opts: ThrottleOptions) {
        this.opts = opts;
    }

    lockedUntil(key: string): number {
        return this.entries.get(key)?.lockedUntil ?? 0;
    }

    isLocked(key: string, now: number): boolean {
        return this.lockedUntil(key) > now;
    }

    recordFailure(key: string, now: number): void {
        const entry = this.entries.get(key) ?? { failures: [], lockedUntil: 0 };
        entry.failures = entry.failures.filter((t) => now - t < this.opts.windowMs);
        entry.failures.push(now);
        if (entry.failures.length >= this.opts.maxFailures) {
            entry.lockedUntil = now + this.opts.lockMs;
            entry.failures = [];
        }
        this.entries.set(key, entry);
    }

    reset(key: string): void {
        this.entries.delete(key);
    }
}
