import type { AppointmentService } from "./service.ts";
import { SlotError, type AppointmentRepo } from "./types.ts";

export interface CoverageReport {
    moved: string[];
    unmoved: { id: string; reason: string }[];
}

// When a clinician calls in sick, hand their booked appointments for the day to a covering
// clinician. Appointments that clash with the cover's own calendar stay put for the front desk.
export async function coverDay(
    service: Pick<AppointmentService, "move">,
    repo: AppointmentRepo,
    absentId: string,
    coverId: string,
    day: string,
): Promise<CoverageReport> {
    const report: CoverageReport = { moved: [], unmoved: [] };
    const booked = (await repo.listForClinician(absentId, day))
        .filter((a) => a.status === "booked")
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    for (const appt of booked) {
        try {
            await service.move(appt.id, { clinicianId: coverId });
            report.moved.push(appt.id);
        } catch (err) {
            if (!(err instanceof SlotError)) throw err;
            report.unmoved.push({ id: appt.id, reason: err.code });
        }
    }
    return report;
}
