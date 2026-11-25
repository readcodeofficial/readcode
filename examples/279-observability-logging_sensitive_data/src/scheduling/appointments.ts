import type { Logger } from "../logging/logger.ts";

export interface Patient {
    id: string;
    name: string;
    dateOfBirth: string;
    phone: string;
    email: string;
    insuranceId: string;
}

export interface Appointment {
    id: string;
    patientId: string;
    clinicId: string;
    startsAt: string;
    reason: { code: string; notes: string };
}

export interface AppointmentStore {
    isSlotFree(clinicId: string, startsAt: string): Promise<boolean>;
    insert(appt: Appointment): Promise<void>;
}

export async function bookAppointment(store: AppointmentStore, log: Logger, patient: Patient, appt: Appointment): Promise<boolean> {
    const l = log.child({ appointmentId: appt.id, clinicId: appt.clinicId });
    if (!(await store.isSlotFree(appt.clinicId, appt.startsAt))) {
        l.warn("slot already taken", { startsAt: appt.startsAt, patient });
        return false;
    }
    await store.insert(appt);
    l.info("appointment booked", { appointment: appt, patient });
    return true;
}
