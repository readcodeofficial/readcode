import { InvalidRequestError, SlotUnavailableError, toSchedulingError } from "./errors.ts";

export interface Slot {
    id: string;
    providerId: string;
    start: string;
}

export interface Appointment {
    id: string;
    slotId: string;
    patientId: string;
    providerId: string;
    start: string;
    reason: string;
}

// The clinic calendar service's client. Every method throws HttpError on a non-2xx response.
export interface CalendarClient {
    findSlot(providerId: string, start: string): Promise<Slot | null>;
    reserve(slot: Slot, booking: { patientId: string; reason: string }): Promise<Appointment>;
    release(appointmentId: string): Promise<void>;
}

export interface BookingRequest {
    patientId: string;
    providerId: string;
    start: string; // ISO date-time
    reason: string;
}

const MIN_NOTICE_MS = 2 * 60 * 60 * 1000;

export class BookingService {
    private readonly calendar: CalendarClient;
    private readonly now: () => Date;

    constructor(calendar: CalendarClient, now: () => Date) {
        this.calendar = calendar;
        this.now = now;
    }

    async book(req: BookingRequest): Promise<Appointment> {
        const startMs = Date.parse(req.start);
        if (Number.isNaN(startMs)) throw new InvalidRequestError("start must be an ISO date-time");
        if (startMs < this.now().getTime() + MIN_NOTICE_MS) throw new InvalidRequestError("appointments need at least 2 hours' notice");
        if (!req.reason.trim()) throw new InvalidRequestError("reason is required");
        const start = new Date(startMs).toISOString();

        try {
            const slot = await this.calendar.findSlot(req.providerId, start);
            if (!slot) throw new SlotUnavailableError(req.providerId, start);
            return this.calendar.reserve(slot, { patientId: req.patientId, reason: req.reason.trim() });
        } catch (err) {
            throw toSchedulingError(err, { providerId: req.providerId, start });
        }
    }

    async cancel(appointmentId: string): Promise<void> {
        try {
            await this.calendar.release(appointmentId);
        } catch (err) {
            throw toSchedulingError(err, { appointmentId });
        }
    }
}
