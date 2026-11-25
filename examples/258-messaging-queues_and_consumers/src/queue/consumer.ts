import { setImmediate as tick } from "node:timers/promises";
import type { Delivery, InMemoryQueue } from "./broker.ts";

export type Handler = (body: string) => Promise<void>;

export interface ConsumerStats {
    inFlight: number;
    processed: number;
    failed: number;
}

// Pulls messages and runs up to `concurrency` handlers at once. A handler that resolves gets its
// message acked; one that throws gets it nacked so the queue delivers it again.
export class Consumer {
    private readonly queue: InMemoryQueue;
    private readonly handler: Handler;
    private readonly concurrency: number;
    private readonly onError: (err: unknown, msg: Delivery) => void;
    private inFlight = 0;
    private processed = 0;
    private failed = 0;

    constructor(queue: InMemoryQueue, handler: Handler, concurrency: number, onError: (err: unknown, msg: Delivery) => void = () => {}) {
        this.queue = queue;
        this.handler = handler;
        this.concurrency = concurrency;
        this.onError = onError;
    }

    // Takes as many messages as there are free slots and starts them; doesn't wait for them to finish.
    async pollOnce(): Promise<number> {
        const free = this.concurrency - this.inFlight;
        if (free <= 0) return 0;
        const messages = await this.queue.receive(free);
        for (const msg of messages) {
            this.inFlight++;
            this.process(msg).then(
                () => {
                    this.inFlight--;
                    this.processed++;
                },
                (err) => {
                    this.failed++;
                    this.onError(err, msg);
                },
            );
        }
        return messages.length;
    }

    private async process(msg: Delivery): Promise<void> {
        try {
            await this.handler(msg.body);
        } catch (err) {
            await this.queue.nack(msg.receipt);
            throw err;
        }
        await this.queue.ack(msg.receipt);
    }

    // Keeps polling until the queue is empty and every handler has finished.
    async drain(maxPolls = 10_000): Promise<void> {
        for (let i = 0; i < maxPolls; i++) {
            const { waiting } = this.queue.depth();
            if (waiting === 0 && this.inFlight === 0) return;
            await this.pollOnce();
            await tick();
        }
        const { waiting } = this.queue.depth();
        throw new Error(`consumer stalled: ${this.inFlight} running, ${waiting} waiting`);
    }

    stats(): ConsumerStats {
        return { inFlight: this.inFlight, processed: this.processed, failed: this.failed };
    }
}
