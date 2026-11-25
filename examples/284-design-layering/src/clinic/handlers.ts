import type { AppointmentService } from "./service.ts";
import { NotFoundError, SlotError, type Appointment, type AppointmentRepo } from "./types.ts";

export interface Req {
    caller: { patientId: string };
    params: Record<string, string>;
    body: Record<string, unknown>;
}

export interface Res {
    status: number;
    body: unknown;
}

const view = (a: Appointment) => ({ id: a.id, clinicianId: a.clinicianId, start: a.start.toISOString(), minutes: a.minutes, status: a.status });
const bad = (message: string): Res => ({ status: 400, body: { error: "bad_request", message } });
const notFound: Res = { status: 404, body: { error: "not_found" } };

function parseStart(v: unknown): Date | null {
    if (typeof v !== "string") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
}

function fromError(err: unknown): Res {
    if (err instanceof SlotError) return { status: err.code === "conflict" ? 409 : 422, body: { error: err.code, message: err.message } };
    if (err instanceof NotFoundError) return notFound;
    throw err;
}

// HTTP layer for the patient app: parses requests, checks the caller owns the appointment,
// and maps service errors onto status codes.
export function appointmentHandlers(service: AppointmentService, repo: AppointmentRepo) {
    // Patients only see their own appointments; anyone else's look the same as a missing one.
    async function ownBooked(req: Req): Promise<Appointment | null> {
        const appt = await repo.get(req.params.id);
        return appt && appt.patientId === req.caller.patientId && appt.status === "booked" ? appt : null;
    }

    return {
        // POST /appointments { clinicianId, start, minutes }
        async book(req: Req): Promise<Res> {
            const { clinicianId, minutes } = req.body;
            const start = parseStart(req.body.start);
            if (typeof clinicianId !== "string" || !clinicianId) return bad("clinicianId is required");
            if (!start) return bad("start must be an ISO timestamp");
            if (typeof minutes !== "number") return bad("minutes must be a number");
            try {
                return { status: 201, body: view(await service.book(req.caller.patientId, clinicianId, start, minutes)) };
            } catch (err) {
                return fromError(err);
            }
        },

        // PATCH /appointments/:id { start }
        async reschedule(req: Req): Promise<Res> {
            const start = parseStart(req.body.start);
            if (!start) return bad("start must be an ISO timestamp");
            const appt = await ownBooked(req);
            if (!appt) return notFound;

            const moved: Appointment = { ...appt, start };
            await repo.save(moved);
            return { status: 200, body: view(moved) };
        },

        // DELETE /appointments/:id
        async cancel(req: Req): Promise<Res> {
            const appt = await ownBooked(req);
            if (!appt) return notFound;
            try {
                return { status: 200, body: view(await service.cancel(appt.id)) };
            } catch (err) {
                return fromError(err);
            }
        },
    };
}
