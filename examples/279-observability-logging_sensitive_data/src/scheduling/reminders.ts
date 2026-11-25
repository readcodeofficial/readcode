import type { Logger } from "../logging/logger.ts";
import type { Patient } from "./appointments.ts";

export interface SmsGateway {
    // Sends one message per recipient; returns the phone numbers it could not deliver to.
    sendBulk(messages: { to: string; body: string }[]): Promise<string[]>;
}

export interface Reminder {
    appointmentId: string;
    startsAt: string;
    patient: Patient;
}

// Day-before SMS reminders, sent in one bulk call per clinic.
export async function sendReminders(sms: SmsGateway, log: Logger, clinicId: string, reminders: Reminder[]): Promise<number> {
    const messages = reminders.map((r) => ({
        to: r.patient.phone,
        body: `Reminder: your appointment is at ${r.startsAt.slice(11, 16)} tomorrow. Reply C to cancel.`,
    }));
    const undelivered = new Set(await sms.sendBulk(messages));
    const failed = reminders.filter((r) => undelivered.has(r.patient.phone));
    if (failed.length > 0) {
        log.error("reminders not delivered", {
            clinicId,
            failedCount: failed.length,
            failed: failed.map((r) => ({ appointmentId: r.appointmentId, patient: r.patient })),
        });
    }
    log.info("reminders sent", { clinicId, sent: reminders.length - failed.length });
    return reminders.length - failed.length;
}
