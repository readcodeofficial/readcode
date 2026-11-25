export class DeadlineExceededError extends Error {
    constructor(budgetMs: number) {
        super(`search budget of ${budgetMs}ms exceeded`);
        this.name = "DeadlineExceededError";
    }
}

export interface Scope {
    signal: AbortSignal;
    // Stops the timer and detaches from the parent. Call when the work is done.
    dispose(): void;
}

// A child signal for one unit of work: it aborts when the parent aborts (the client went away)
// or when the time budget runs out, whichever comes first. The reason says which.
export function withDeadline(parent: AbortSignal, budgetMs: number): Scope {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort(parent.reason);
    parent.addEventListener("abort", onParentAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new DeadlineExceededError(budgetMs)), budgetMs);
    return {
        signal: controller.signal,
        dispose() {
            clearTimeout(timer);
            parent.removeEventListener("abort", onParentAbort);
        },
    };
}
