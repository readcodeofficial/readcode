import { SlotUnavailableError } from "./errors.ts";
import type { Appointment, BookingRequest, BookingService } from "./service.ts";

export type BookOrWait =
    | { status: "booked"; appointment: Appointment }
    | { status: "waitlisted"; position: number };

// Patients who opt in are put on the provider's waitlist when their requested time is gone.
export class Waitlist {
    private readonly service: BookingService;
    private readonly byProvider = new Map<string, BookingRequest[]>();

    constructor(service: BookingService) {
        this.service = service;
    }

    async bookOrJoin(req: BookingRequest): Promise<BookOrWait> {
        try {
            return { status: "booked", appointment: await this.service.book(req) };
        } catch (err) {
            if (!(err instanceof SlotUnavailableError)) throw err;
            const queue = this.byProvider.get(req.providerId) ?? [];
            queue.push(req);
            this.byProvider.set(req.providerId, queue);
            return { status: "waitlisted", position: queue.length };
        }
    }

    waiting(providerId: string): string[] {
        return (this.byProvider.get(providerId) ?? []).map((r) => r.patientId);
    }
}
