import { randomUUID } from "node:crypto";

export interface Delivery {
    id: string;
    receipt: string; // identifies this delivery; needed to ack or nack it
    body: string;
    receiveCount: number;
}

interface Stored {
    id: string;
    body: string;
    receiveCount: number;
}

// In-memory stand-in for a hosted queue (SQS-like): received messages are hidden from other
// consumers until they are acked (deleted) or nacked (made visible again for redelivery).
export class InMemoryQueue {
    private visible: Stored[] = [];
    private readonly inFlight = new Map<string, Stored>();

    async send(body: string): Promise<string> {
        const id = randomUUID();
        this.visible.push({ id, body, receiveCount: 0 });
        return id;
    }

    async receive(max: number): Promise<Delivery[]> {
        const taken = this.visible.splice(0, max);
        return taken.map((m) => {
            m.receiveCount++;
            const receipt = randomUUID();
            this.inFlight.set(receipt, m);
            return { id: m.id, receipt, body: m.body, receiveCount: m.receiveCount };
        });
    }

    async ack(receipt: string): Promise<void> {
        if (!this.inFlight.delete(receipt)) throw new Error(`unknown receipt ${receipt}`);
    }

    async nack(receipt: string): Promise<void> {
        const m = this.inFlight.get(receipt);
        if (!m) throw new Error(`unknown receipt ${receipt}`);
        this.inFlight.delete(receipt);
        this.visible.push(m);
    }

    depth(): { waiting: number; inFlight: number } {
        return { waiting: this.visible.length, inFlight: this.inFlight.size };
    }
}
