// The slice of a WebSocket the hub relies on. Production wraps `ws`; tests use fakes.
export interface Connection {
    readonly id: string;
    readonly readyState: "open" | "closing" | "closed";
    readonly bufferedAmount: number; // bytes queued but not yet flushed to the client
    send(frame: string): void;
    close(code: number, reason: string): void;
}

export const CLOSE_TRY_AGAIN_LATER = 1013;
export const CLOSE_POLICY_VIOLATION = 1008;
