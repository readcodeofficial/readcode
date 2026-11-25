import { dayOf, NotFoundError, SlotError, type Appointment, type AppointmentRepo } from "./types.ts";

const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;
const SLOT_MINUTES = 15;
const MINUTE = 60_000;

// Business rules for the clinic calendar. Every write to an appointment's time or
// clinician goes through checkSlot so a clinician is never double-booked.
export class AppointmentService {
    private readonly repo: AppointmentRepo;
    private readonly newId: () => string;

    constructor(repo: AppointmentRepo, newId: () => string) {
        this.repo = repo;
        this.newId = newId;
    }

    async book(patientId: string, clinicianId: string, start: Date, minutes: number): Promise<Appointment> {
        const appt: Appointment = { id: this.newId(), patientId, clinicianId, start, minutes, status: "booked" };
        await this.checkSlot(appt);
        await this.repo.save(appt);
        return appt;
    }

    // Move an appointment to a new time and/or clinician; the same slot rules apply as for a new booking.
    async move(id: string, change: { start?: Date; clinicianId?: string }): Promise<Appointment> {
        const current = await this.repo.get(id);
        if (!current || current.status !== "booked") throw new NotFoundError(id);
        const moved: Appointment = { ...current, ...change };
        await this.checkSlot(moved);
        await this.repo.save(moved);
        return moved;
    }

    async cancel(id: string): Promise<Appointment> {
        const current = await this.repo.get(id);
        if (!current || current.status !== "booked") throw new NotFoundError(id);
        const cancelled: Appointment = { ...current, status: "cancelled" };
        await this.repo.save(cancelled);
        return cancelled;
    }

    private async checkSlot(appt: Appointment): Promise<void> {
        const startMinute = appt.start.getUTCHours() * 60 + appt.start.getUTCMinutes();
        const endMinute = startMinute + appt.minutes;
        const aligned = appt.start.getUTCSeconds() === 0 && appt.start.getUTCMilliseconds() === 0 && startMinute % SLOT_MINUTES === 0;
        if (!aligned || appt.minutes <= 0 || appt.minutes % SLOT_MINUTES !== 0) {
            throw new SlotError("misaligned", `Appointments start and last in ${SLOT_MINUTES}-minute steps`);
        }
        if (startMinute < OPEN_HOUR * 60 || endMinute > CLOSE_HOUR * 60) {
            throw new SlotError("outside_hours", `The clinic is open ${OPEN_HOUR}:00-${CLOSE_HOUR}:00 UTC`);
        }

        const start = appt.start.getTime();
        const end = start + appt.minutes * MINUTE;
        const sameDay = await this.repo.listForClinician(appt.clinicianId, dayOf(appt.start));
        const clash = sameDay.find(
            (o) => o.id !== appt.id && o.status === "booked" && o.start.getTime() < end && start < o.start.getTime() + o.minutes * MINUTE,
        );
        if (clash) throw new SlotError("conflict", `Clinician ${appt.clinicianId} already has appointment ${clash.id} then`);
    }
}
