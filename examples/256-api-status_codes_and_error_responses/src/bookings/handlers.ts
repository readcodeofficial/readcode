import { ValidationError } from "./errors.ts";
import { errorResponse, json, type HttpResponse } from "./http.ts";
import type { ReservationService } from "./service.ts";

export interface HttpRequest {
    params: Record<string, string>;
    body?: unknown;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseBooking(body: unknown) {
    if (typeof body !== "object" || body === null) throw new ValidationError("body", "Body must be a JSON object");
    const b = body as Record<string, unknown>;
    for (const field of ["roomId", "guestName", "checkIn", "checkOut"]) {
        if (typeof b[field] !== "string" || b[field] === "") throw new ValidationError(field, `${field} is required`);
    }
    const { roomId, guestName, checkIn, checkOut } = b as Record<string, string>;
    if (!DATE.test(checkIn)) throw new ValidationError("checkIn", "checkIn must be YYYY-MM-DD");
    if (!DATE.test(checkOut)) throw new ValidationError("checkOut", "checkOut must be YYYY-MM-DD");
    if (checkOut <= checkIn) throw new ValidationError("checkOut", "checkOut must be after checkIn");
    return { roomId, guestName, checkIn, checkOut };
}

export function bookingHandlers(service: ReservationService, log: (err: unknown) => void) {
    const handle = (fn: (req: HttpRequest) => Promise<HttpResponse>) => async (req: HttpRequest) => {
        try {
            return await fn(req);
        } catch (err) {
            return errorResponse(err, log);
        }
    };

    return {
        // POST /reservations
        create: handle(async (req) => {
            const r = await service.book(parseBooking(req.body));
            return json(201, r, { Location: `/reservations/${r.id}` });
        }),
        // GET /reservations/:id
        get: handle(async (req) => json(200, await service.get(req.params.id))),
        // POST /reservations/:id/cancel
        cancel: handle(async (req) => json(200, await service.cancel(req.params.id))),
    };
}
