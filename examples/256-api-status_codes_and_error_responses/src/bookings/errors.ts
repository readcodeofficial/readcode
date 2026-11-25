// Every business-rule failure in the booking domain is a BookingError with a stable machine-readable code.
export class BookingError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
        super(message);
        this.name = "BookingError";
        this.code = code;
    }
}

export class ValidationError extends BookingError {
    readonly field: string;
    constructor(field: string, message: string) {
        super("invalid_request", message);
        this.name = "ValidationError";
        this.field = field;
    }
}

export class ReservationNotFoundError extends BookingError {
    constructor(id: string) {
        super("reservation_not_found", `No reservation ${id}`);
        this.name = "ReservationNotFoundError";
    }
}

export class RoomUnavailableError extends BookingError {
    constructor(roomId: string) {
        super("room_unavailable", `Room ${roomId} is already booked for some of those nights`);
        this.name = "RoomUnavailableError";
    }
}

export class ReservationClosedError extends BookingError {
    constructor(id: string, status: string) {
        super("reservation_closed", `Reservation ${id} is ${status} and can no longer be changed`);
        this.name = "ReservationClosedError";
    }
}

// Not a business rule: the channel-manager (inventory) call timed out.
export class UpstreamTimeoutError extends Error {
    readonly retryAfterSeconds: number;
    constructor(service: string, retryAfterSeconds: number) {
        super(`${service} did not answer in time`);
        this.name = "UpstreamTimeoutError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
