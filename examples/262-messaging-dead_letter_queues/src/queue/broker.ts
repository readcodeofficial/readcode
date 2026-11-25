import { randomUUID } from "node:crypto";

export type Attributes = Record<string, string>;

export interface Delivery {
    id: string; // stable for the life of the message
    receipt: string; // new on every delivery; used to ack or nack it
    body: string;
    attributes: Attributes;
}

interface Stored {
    id: string;
    body: string;
    attributes: Attributes;
}

// In-memory stand-in for a hosted queue. A nacked message becomes visible again and is
// redelivered with a fresh receipt.
export class InMemoryQueue {
    private visible: Stored[] = [];
    private readonly inFlight = new Map<string, Stored>();

    async send(body: string, attributes: Attributes = {}): Promise<string> {
        const id = randomUUID();
        this.visible.push({ id, body, attributes: { ...attributes } });
        return id;
    }

    async receive(max: number): Promise<Delivery[]> {
        return this.visible.splice(0, max).map((m) => {
            const receipt = randomUUID();
            this.inFlight.set(receipt, m);
            return { ...m, receipt };
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

    depth(): number {
        return this.visible.length + this.inFlight.size;
    }
}
