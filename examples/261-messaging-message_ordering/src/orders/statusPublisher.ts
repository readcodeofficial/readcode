import { TransientSendError, type PartitionedTopic } from "../bus/topic.ts";

export type OrderStatus = "placed" | "accepted" | "preparing" | "picked_up" | "delivered" | "cancelled";

export interface StatusEvent {
    orderId: string;
    status: OrderStatus;
    at: string; // ISO time the status changed
}

// The restaurant and courier apps report status changes here. They're buffered and sent in batches,
// keyed by order id so every update for one order lands on the same partition.
export class StatusPublisher {
    private readonly topic: PartitionedTopic<StatusEvent>;
    private pending: StatusEvent[] = [];

    constructor(topic: PartitionedTopic<StatusEvent>) {
        this.topic = topic;
    }

    enqueue(event: StatusEvent): void {
        this.pending.push(event);
    }

    pendingCount(): number {
        return this.pending.length;
    }

    // Sends what's buffered. Events that hit a transient broker error stay buffered for the next flush.
    async flush(): Promise<number> {
        const batch = this.pending.splice(0);
        let sent = 0;
        for (const event of batch) {
            try {
                await this.topic.send(this.topic.partitionFor(event.orderId), event);
                sent++;
            } catch (err) {
                if (!(err instanceof TransientSendError)) throw err;
                this.pending.push(event);
            }
        }
        return sent;
    }

    // Flushes until the buffer is empty or `maxFlushes` is reached (called on a timer and at shutdown).
    async flushAll(maxFlushes = 10): Promise<void> {
        for (let i = 0; i < maxFlushes && this.pending.length > 0; i++) await this.flush();
        if (this.pending.length > 0) throw new Error(`${this.pending.length} status events still unsent`);
    }
}
