import { randomUUID } from "node:crypto";

export type Headers = Record<string, string>;

export interface Delivery {
    id: string; // assigned by the broker on publish
    receipt: string; // this delivery only
    body: string;
    headers: Headers;
}

export class PublishTimeoutError extends Error {
    constructor() {
        super("publish timed out waiting for broker confirmation");
        this.name = "PublishTimeoutError";
    }
}

interface Stored {
    id: string;
    body: string;
    headers: Headers;
}

// In-memory stand-in for the event bus. `timeoutsAfterAccept` simulates the classic failure where
// the broker stores the message but the confirmation is lost, so the producer sees a timeout.
export class InMemoryBroker {
    timeoutsAfterAccept = 0;
    private visible: Stored[] = [];
    private readonly inFlight = new Map<string, Stored>();

    async publish(body: string, headers: Headers = {}): Promise<string> {
        const id = randomUUID();
        this.visible.push({ id, body, headers: { ...headers } });
        if (this.timeoutsAfterAccept > 0) {
            this.timeoutsAfterAccept--;
            throw new PublishTimeoutError();
        }
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
        this.inFlight.delete(receipt);
    }

    async nack(receipt: string): Promise<void> {
        const m = this.inFlight.get(receipt);
        if (!m) return;
        this.inFlight.delete(receipt);
        this.visible.push(m);
    }

    // Visibility timeout lapsed (e.g. the consumer crashed before acking): unacked messages come back.
    expireInFlight(): void {
        this.visible.push(...this.inFlight.values());
        this.inFlight.clear();
    }

    depth(): number {
        return this.visible.length + this.inFlight.size;
    }
}
