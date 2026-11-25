import {
    BookingError,
    ReservationClosedError,
    ReservationNotFoundError,
    RoomUnavailableError,
    UpstreamTimeoutError,
    ValidationError,
} from "./errors.ts";

export interface HttpResponse {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
}

type ErrorClass = abstract new (...args: never[]) => Error;

// The first entry whose class matches decides the status.
const STATUS_BY_ERROR: [ErrorClass, number][] = [
    [ValidationError, 400],
    [BookingError, 422],
    [ReservationNotFoundError, 404],
    [RoomUnavailableError, 409],
    [ReservationClosedError, 409],
    [UpstreamTimeoutError, 503],
];

export function json(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
    return { status, headers: { "Content-Type": "application/json", ...headers }, body };
}

// Turns anything a handler threw into the API's error envelope: { error: { code, message, field? } }.
// Unexpected errors are logged and answered with a generic 500 so internals never reach the client.
export function errorResponse(err: unknown, log: (err: unknown) => void): HttpResponse {
    const match = STATUS_BY_ERROR.find(([cls]) => err instanceof cls);
    if (!match) {
        log(err);
        return json(500, { error: { code: "internal_error", message: "Something went wrong" } });
    }
    const status = match[1];

    if (err instanceof UpstreamTimeoutError) {
        return json(status, { error: { code: "temporarily_unavailable", message: "Please retry shortly" } }, {
            "Retry-After": String(err.retryAfterSeconds),
        });
    }
    const e = err as BookingError;
    const error: Record<string, string> = { code: e.code, message: e.message };
    if (e instanceof ValidationError) error.field = e.field;
    return json(status, { error });
}
