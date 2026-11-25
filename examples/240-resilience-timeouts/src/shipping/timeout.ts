export class TimeoutError extends Error {
    readonly label: string;

    constructor(label: string, ms: number) {
        super(`${label} timed out after ${ms}ms`);
        this.name = "TimeoutError";
        this.label = label;
    }
}

// Gives `work` at most `ms` milliseconds. The signal passed to `work` is aborted when the time is up,
// so it can cancel its request. The timer is always cleared.
export async function withTimeout<T>(label: string, ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new TimeoutError(label, ms)), ms);
    try {
        return await work(controller.signal);
    } finally {
        clearTimeout(timer);
    }
}
