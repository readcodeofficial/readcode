import {
    AppointmentNotFoundError,
    CalendarUnavailableError,
    InvalidRequestError,
    SlotUnavailableError,
} from "./errors.ts";
import type { BookingRequest, BookingService } from "./service.ts";

export interface Response {
    status: number;
    headers?: Record<string, string>;
    body: unknown;
}

// Maps scheduling errors onto HTTP responses for the patient app. Anything unexpected is a 500.
export function errorResponse(err: unknown): Response {
    if (err instanceof InvalidRequestError) return { status: 400, body: { code: "invalid_request", error: err.message } };
    if (err instanceof SlotUnavailableError) return { status: 409, body: { code: "slot_taken", error: "That time was just taken, please pick another" } };
    if (err instanceof AppointmentNotFoundError) return { status: 404, body: { code: "not_found", error: err.message } };
    if (err instanceof CalendarUnavailableError) {
        return { status: 503, headers: { "Retry-After": String(err.retryAfterSeconds) }, body: { code: "calendar_unavailable", error: err.message } };
    }
    return { status: 500, body: { code: "internal", error: "Something went wrong" } };
}

// POST /appointments
export async function postAppointment(service: BookingService, body: BookingRequest): Promise<Response> {
    try {
        return { status: 201, body: await service.book(body) };
    } catch (err) {
        return errorResponse(err);
    }
}

// DELETE /appointments/:id
export async function deleteAppointment(service: BookingService, id: string): Promise<Response> {
    try {
        await service.cancel(id);
        return { status: 204, body: undefined };
    } catch (err) {
        return errorResponse(err);
    }
}
