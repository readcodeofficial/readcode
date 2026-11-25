// Error thrown by the clinic calendar's HTTP client for any non-2xx response.
export class HttpError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

// Errors the scheduling domain understands; everything above the service speaks only these.
export class SchedulingError extends Error {}

export class InvalidRequestError extends SchedulingError {
    constructor(message: string) {
        super(message);
        this.name = "InvalidRequestError";
    }
}

export class SlotUnavailableError extends SchedulingError {
    constructor(providerId: string, start: string, options?: ErrorOptions) {
        super(`Provider ${providerId} has no free slot at ${start}`, options);
        this.name = "SlotUnavailableError";
    }
}

export class AppointmentNotFoundError extends SchedulingError {
    constructor(appointmentId: string, options?: ErrorOptions) {
        super(`Appointment ${appointmentId} not found`, options);
        this.name = "AppointmentNotFoundError";
    }
}

export class CalendarUnavailableError extends SchedulingError {
    readonly retryAfterSeconds: number;
    constructor(retryAfterSeconds: number, options?: ErrorOptions) {
        super("The clinic calendar is temporarily unavailable", options);
        this.name = "CalendarUnavailableError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

export interface CallContext {
    providerId?: string;
    start?: string;
    appointmentId?: string;
}

// Translates calendar client failures into scheduling errors. Unknown errors pass through unchanged.
export function toSchedulingError(err: unknown, ctx: CallContext): unknown {
    if (err instanceof SchedulingError || !(err instanceof HttpError)) return err;
    if (err.status === 409) return new SlotUnavailableError(ctx.providerId ?? "?", ctx.start ?? "?", { cause: err });
    if (err.status === 404 && ctx.appointmentId) return new AppointmentNotFoundError(ctx.appointmentId, { cause: err });
    if (err.status === 429 || err.status >= 500) return new CalendarUnavailableError(err.status === 429 ? 60 : 15, { cause: err });
    return err;
}
