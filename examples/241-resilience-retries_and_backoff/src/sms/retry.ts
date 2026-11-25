import { GatewayError, isRetryable } from "./errors.ts";

export interface RetryPolicy {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

export interface RetryDeps {
    sleep: (ms: number) => Promise<void>;
    random: () => number; // [0, 1)
}

export async function withRetry<T>(policy: RetryPolicy, deps: RetryDeps, attemptFn: (attempt: number) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await attemptFn(attempt);
        } catch (err) {
            if (attempt >= policy.maxAttempts || !isRetryable(err)) throw err;
            await deps.sleep(delayBeforeRetry(policy, attempt, err, deps.random));
        }
    }
}

// Exponential backoff with jitter (between half and all of the step), so a fleet of senders
// that failed together doesn't retry in lockstep.
export function delayBeforeRetry(policy: RetryPolicy, attempt: number, err: unknown, random: () => number): number {
    const step = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
    const backoff = Math.round(step / 2 + (random() * step) / 2);
    const retryAfter = err instanceof GatewayError ? err.retryAfterMs : undefined;
    return retryAfter === undefined ? backoff : Math.min(retryAfter, backoff);
}
