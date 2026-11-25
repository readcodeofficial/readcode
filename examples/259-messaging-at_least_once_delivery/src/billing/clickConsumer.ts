import type { LogRecord, PartitionLog } from "../log/partitionLog.ts";
import { InvalidClickError, parseClick, type LedgerStore } from "./clicks.ts";

export interface PollResult {
    billed: number;
    invalid: number;
    failed: number;
}

// Reads the click stream and records a charge per click. Committing an offset tells the log
// "everything before this is done", so a restarted consumer resumes from there.
export class ClickConsumer {
    private readonly log: PartitionLog;
    private readonly group: string;
    private readonly ledger: LedgerStore;
    private readonly batchSize: number;
    private readonly onError: (err: unknown, offset: number) => void;

    constructor(log: PartitionLog, group: string, ledger: LedgerStore, batchSize = 100, onError: (err: unknown, offset: number) => void = () => {}) {
        this.log = log;
        this.group = group;
        this.ledger = ledger;
        this.batchSize = batchSize;
        this.onError = onError;
    }

    private async bill(record: LogRecord): Promise<"billed" | "invalid"> {
        let click;
        try {
            click = parseClick(record.value);
        } catch (err) {
            if (err instanceof InvalidClickError) return "invalid"; // retrying won't fix a bad record
            throw err;
        }
        await this.ledger.upsertCharge(click);
        return "billed";
    }

    async pollOnce(): Promise<PollResult> {
        const from = await this.log.committed(this.group);
        const batch = await this.log.read(from, this.batchSize);
        const result: PollResult = { billed: 0, invalid: 0, failed: 0 };
        if (batch.length === 0) return result;

        // Clicks are independent of each other, so a batch is billed in parallel.
        const outcomes = await Promise.allSettled(batch.map((record) => this.bill(record)));
        outcomes.forEach((o, i) => {
            if (o.status === "fulfilled") result[o.value]++;
            else {
                result.failed++;
                this.onError(o.reason, batch[i].offset);
            }
        });

        await this.log.commit(this.group, batch[batch.length - 1].offset + 1);
        return result;
    }

    // Polls until the committed offset reaches the end of the log (or gives up after maxPolls).
    async catchUp(maxPolls = 50): Promise<PollResult> {
        const total: PollResult = { billed: 0, invalid: 0, failed: 0 };
        for (let i = 0; i < maxPolls && (await this.log.committed(this.group)) < this.log.endOffset(); i++) {
            const r = await this.pollOnce();
            total.billed += r.billed;
            total.invalid += r.invalid;
            total.failed += r.failed;
        }
        return total;
    }
}
