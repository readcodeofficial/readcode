export type Context = Record<string, string | number | boolean | undefined>;

export interface AppErrorOptions {
    code?: string;
    retryable?: boolean;
    context?: Context;
    cause?: unknown;
}

// An error with a stable code for dashboards, a retryable flag for callers,
// and the context of the layer that raised it. Lower-level errors hang off `cause`.
export class AppError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    readonly context: Context;

    constructor(message: string, options: AppErrorOptions = {}) {
        super(message, { cause: options.cause });
        this.name = "AppError";
        this.code = options.code ?? "internal";
        this.retryable = options.retryable ?? false;
        this.context = options.context ?? {};
    }
}

const describe = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Adds a layer of context on the way up. An already-classified error keeps its code and retryability.
export function wrap(err: unknown, message: string, context: Context = {}): AppError {
    if (err instanceof AppError) {
        return new AppError(`${message}: ${err.message}`, {
            code: err.code,
            retryable: err.retryable,
            context,
            cause: err.cause,
        });
    }
    return new AppError(`${message}: ${describe(err)}`, { context, cause: err });
}

// Outermost error first.
export function errorChain(err: unknown): unknown[] {
    const chain: unknown[] = [];
    for (let e: unknown = err; e !== undefined && chain.length < 20; e = e instanceof Error ? e.cause : undefined) chain.push(e);
    return chain;
}

export function isRetryable(err: unknown): boolean {
    return errorChain(err).some((e) => e instanceof AppError && e.retryable);
}

// Every layer's context in one object; where two layers set the same key, the outer one wins.
export function mergedContext(err: unknown): Context {
    const merged: Context = {};
    for (const e of errorChain(err).reverse()) if (e instanceof AppError) Object.assign(merged, e.context);
    return merged;
}

export interface LogRecord {
    level: "error";
    code: string;
    message: string;
    context: Context;
    causes: string[];
}

export function toLogRecord(err: unknown): LogRecord {
    return {
        level: "error",
        code: err instanceof AppError ? err.code : "internal",
        message: describe(err),
        context: mergedContext(err),
        causes: errorChain(err).slice(1).map((e) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e))),
    };
}
