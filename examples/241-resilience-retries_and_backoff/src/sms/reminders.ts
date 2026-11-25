import type { SmsSender } from "./sender.ts";

export interface Reservation {
    id: string;
    guestName: string;
    phone: string;
    restaurant: string;
    partySize: number;
    at: Date;
}

export interface ReminderReport {
    sent: string[]; // reservation ids
    failed: { id: string; error: string }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Runs every 15 minutes: texts guests whose table is within the next 24 hours.
// The idempotency key is per reservation, so overlapping runs don't text anyone twice.
export async function sendReminders(sender: SmsSender, reservations: Reservation[], now: Date): Promise<ReminderReport> {
    const due = reservations.filter((r) => r.at.getTime() > now.getTime() && r.at.getTime() - now.getTime() <= DAY_MS);
    const report: ReminderReport = { sent: [], failed: [] };
    for (const r of due) {
        const time = r.at.toISOString().slice(11, 16);
        const body = `Hi ${r.guestName}, see you at ${r.restaurant} at ${time} UTC (party of ${r.partySize}). Reply C to cancel.`;
        try {
            await sender.send({ to: r.phone, body, idempotencyKey: `reminder:${r.id}` });
            report.sent.push(r.id);
        } catch (err) {
            report.failed.push({ id: r.id, error: (err as Error).message });
        }
    }
    return report;
}
