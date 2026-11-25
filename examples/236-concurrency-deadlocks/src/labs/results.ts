import type { AuditLog } from "./audit.ts";
import type { ConnectionPool } from "./pool.ts";

export interface LabResultInput {
    accession: string; // lab's unique specimen number
    patientId: string;
    test: string; // e.g. "potassium"
    value: number;
    refLow: number;
    refHigh: number;
}

export type Flag = "normal" | "low" | "high" | "critical";

// Outside this band (as a multiple of the reference range) a result is phoned to the care team.
const CRITICAL_FACTOR = 0.5;

export function flagFor(r: LabResultInput): Flag {
    const span = r.refHigh - r.refLow;
    if (r.value < r.refLow - span * CRITICAL_FACTOR || r.value > r.refHigh + span * CRITICAL_FACTOR) return "critical";
    if (r.value < r.refLow) return "low";
    if (r.value > r.refHigh) return "high";
    return "normal";
}

export class LabResultService {
    private readonly pool: ConnectionPool;
    private readonly audit: AuditLog;
    private readonly now: () => Date;

    constructor(pool: ConnectionPool, audit: AuditLog, now: () => Date) {
        this.pool = pool;
        this.audit = audit;
        this.now = now;
    }

    async record(input: LabResultInput, actor: string): Promise<Flag> {
        if (!input.accession || !input.patientId) throw new Error("accession and patientId are required");
        if (!Number.isFinite(input.value) || !(input.refLow < input.refHigh)) throw new Error(`Invalid result for ${input.accession}`);
        const flag = flagFor(input);

        return this.pool.withConnection(async (conn) => {
            await conn.query("BEGIN");
            try {
                await conn.query("INSERT INTO lab_results", [input.accession, input.patientId, input.test, input.value, flag]);
                await this.audit.record({ actor, action: "lab_result.recorded", subject: input.accession, at: this.now() });
                if (flag === "critical") {
                    await conn.query("INSERT INTO critical_alerts", [input.accession, input.patientId, input.test]);
                }
                await conn.query("COMMIT");
                return flag;
            } catch (err) {
                await conn.query("ROLLBACK");
                throw err;
            }
        });
    }
}
