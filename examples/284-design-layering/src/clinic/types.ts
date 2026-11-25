export interface Appointment {
    id: string;
    patientId: string;
    clinicianId: string;
    start: Date;
    minutes: number;
    status: "booked" | "cancelled";
}

export interface AppointmentRepo {
    get(id: string): Promise<Appointment | null>;
    // Every appointment (any status) the clinician has on a UTC day, "YYYY-MM-DD".
    listForClinician(clinicianId: string, day: string): Promise<Appointment[]>;
    save(appt: Appointment): Promise<void>;
}

export type SlotProblem = "misaligned" | "outside_hours" | "conflict";

export class SlotError extends Error {
    readonly code: SlotProblem;
    constructor(code: SlotProblem, message: string) {
        super(message);
        this.name = "SlotError";
        this.code = code;
    }
}

export class NotFoundError extends Error {
    constructor(id: string) {
        super(`No booked appointment ${id}`);
        this.name = "NotFoundError";
    }
}

export const dayOf = (d: Date) => d.toISOString().slice(0, 10);
