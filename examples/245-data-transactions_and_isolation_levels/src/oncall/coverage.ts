import type { Store } from "../db/store.ts";
import { shiftPrefix, type OnCallEntry } from "./rota.ts";

export interface ShiftCoverage {
    shiftId: string;
    onCall: string[];
}

// The bed-manager dashboard: who is on call for each shift, read from one consistent snapshot.
export async function coverageReport(db: Store, shiftIds: string[]): Promise<ShiftCoverage[]> {
    return db.transaction(async (tx) => {
        const report: ShiftCoverage[] = [];
        for (const shiftId of shiftIds) {
            const entries = await tx.scan<OnCallEntry>(shiftPrefix(shiftId));
            report.push({ shiftId, onCall: entries.filter(([, e]) => e.onCall).map(([, e]) => e.doctorId) });
        }
        return report;
    });
}

export const uncovered = (report: ShiftCoverage[]) => report.filter((s) => s.onCall.length === 0).map((s) => s.shiftId);
