export class GatewayError extends Error {
    readonly status: number;
    readonly retryAfterMs: number | undefined;

    constructor(status: number, message: string, retryAfterMs?: number) {
        super(`SMS gateway ${status}: ${message}`);
        this.name = "GatewayError";
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }

    static fromResponse(status: number, headers: Record<string, string>, body: string, now: Date): GatewayError {
        return new GatewayError(status, body, parseRetryAfter(headers["retry-after"], now));
    }
}

// Retry-After is either a number of seconds or an HTTP date.
export function parseRetryAfter(value: string | undefined, now: Date): number | undefined {
    if (value === undefined || value.trim() === "") return undefined;
    if (/^\d+$/.test(value.trim())) return Number(value) * 1000;
    const at = Date.parse(value);
    return Number.isNaN(at) ? undefined : Math.max(0, at - now.getTime());
}

// Throttling, gateway outages and dropped connections are worth retrying; a bad number or
// a rejected message body will fail the same way every time.
export function isRetryable(err: unknown): boolean {
    if (err instanceof GatewayError) return err.status === 429 || err.status >= 500;
    return (err as { code?: string })?.code === "ECONNRESET" || (err as { code?: string })?.code === "ETIMEDOUT";
}
