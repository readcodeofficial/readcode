import type { Store } from "../db/store.ts";

export interface OnCallEntry {
    doctorId: string;
    shiftId: string;
    onCall: boolean;
    changedAt: string;
}

export type LeaveResult = "left" | "refused_last_cover";

export const entryKey = (shiftId: string, doctorId: string) => `oncall/${shiftId}/${doctorId}`;
export const shiftPrefix = (shiftId: string) => `oncall/${shiftId}/`;

// Hospital on-call rota. Each ward shift must always have at least `minimumCover` doctors on call.
export class RotaService {
    private readonly db: Store;
    private readonly minimumCover: number;

    constructor(db: Store, minimumCover = 1) {
        this.db = db;
        this.minimumCover = minimumCover;
    }

    async join(shiftId: string, doctorId: string, now: Date): Promise<void> {
        await this.db.transaction(async (tx) => {
            tx.put(entryKey(shiftId, doctorId), { doctorId, shiftId, onCall: true, changedAt: now.toISOString() });
        });
    }

    // A doctor asks to come off call (e.g. called into surgery). Refused if they are the last cover.
    async leave(shiftId: string, doctorId: string, now: Date): Promise<LeaveResult> {
        return this.db.transaction(async (tx) => {
            const entry = await tx.get<OnCallEntry>(entryKey(shiftId, doctorId));
            if (!entry?.onCall) throw new Error(`${doctorId} is not on call for ${shiftId}`);

            const covering = (await tx.scan<OnCallEntry>(shiftPrefix(shiftId))).filter(([, e]) => e.onCall);
            if (covering.length <= this.minimumCover) return "refused_last_cover";

            tx.put(entryKey(shiftId, doctorId), { ...entry, onCall: false, changedAt: now.toISOString() });
            return "left";
        });
    }

    // Hands a doctor's on-call slot to a colleague; cover stays the same.
    async handOver(shiftId: string, fromId: string, toId: string, now: Date): Promise<void> {
        await this.db.transaction(async (tx) => {
            const from = await tx.get<OnCallEntry>(entryKey(shiftId, fromId));
            if (!from?.onCall) throw new Error(`${fromId} is not on call for ${shiftId}`);
            const changedAt = now.toISOString();
            tx.put(entryKey(shiftId, fromId), { ...from, onCall: false, changedAt });
            tx.put(entryKey(shiftId, toId), { doctorId: toId, shiftId, onCall: true, changedAt });
        });
    }
}
