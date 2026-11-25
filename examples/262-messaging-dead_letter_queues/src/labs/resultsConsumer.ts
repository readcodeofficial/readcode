import type { Delivery, InMemoryQueue } from "../queue/broker.ts";
import { MalformedResultError, parseResult, type ChartStore } from "./results.ts";

export interface ConsumerStats {
    charted: number;
    retried: number;
    deadLettered: number;
}

// Files incoming lab results into patient charts. Failures are retried up to maxAttempts
// deliveries, then parked on the dead-letter queue for the integration team to inspect and redrive.
export class LabResultsConsumer {
    private readonly main: InMemoryQueue;
    private readonly dlq: InMemoryQueue;
    private readonly charts: ChartStore;
    private readonly maxAttempts: number;
    private readonly attempts = new Map<string, number>();
    readonly stats: ConsumerStats = { charted: 0, retried: 0, deadLettered: 0 };

    constructor(main: InMemoryQueue, dlq: InMemoryQueue, charts: ChartStore, maxAttempts = 3) {
        this.main = main;
        this.dlq = dlq;
        this.charts = charts;
        this.maxAttempts = maxAttempts;
    }

    private async deadLetter(msg: Delivery, err: Error, attempts: number): Promise<void> {
        await this.dlq.send(msg.body, {
            ...msg.attributes,
            "x-original-id": msg.id,
            "x-error": `${err.name}: ${err.message}`,
            "x-attempts": String(attempts),
        });
        await this.main.ack(msg.receipt);
        this.stats.deadLettered++;
    }

    async handle(msg: Delivery): Promise<void> {
        const key = msg.receipt;
        try {
            await this.charts.addResult(parseResult(msg.body));
        } catch (err) {
            // A malformed message will never parse, however often we retry it.
            if (err instanceof MalformedResultError) return this.deadLetter(msg, err, 1);

            const attempts = (this.attempts.get(key) ?? 0) + 1;
            if (attempts >= this.maxAttempts) {
                this.attempts.delete(key);
                return this.deadLetter(msg, err as Error, attempts);
            }
            this.attempts.set(key, attempts);
            this.stats.retried++;
            await this.main.nack(msg.receipt);
            return;
        }
        this.attempts.delete(key);
        this.stats.charted++;
        await this.main.ack(msg.receipt);
    }

    async drain(maxRounds = 200): Promise<void> {
        for (let i = 0; i < maxRounds; i++) {
            const batch = await this.main.receive(10);
            if (batch.length === 0) return;
            for (const msg of batch) await this.handle(msg);
        }
        throw new Error(`queue not drained after ${maxRounds} rounds: ${this.main.depth()} messages left`);
    }
}
