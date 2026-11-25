import type { InMemoryQueue } from "../queue/broker.ts";

// Ops tool: once the cause is fixed (e.g. the patient is now registered), move dead-lettered
// messages back onto the main queue. Messages the filter rejects stay on the DLQ.
export async function redrive(dlq: InMemoryQueue, main: InMemoryQueue, filter: (body: string) => boolean = () => true): Promise<number> {
    const parked = await dlq.receive(dlq.depth());
    let moved = 0;
    for (const msg of parked) {
        if (!filter(msg.body)) {
            await dlq.nack(msg.receipt);
            continue;
        }
        const { "x-error": _e, "x-attempts": _a, "x-original-id": _id, ...original } = msg.attributes;
        await main.send(msg.body, { ...original, "x-redriven-from": msg.attributes["x-original-id"] ?? msg.id });
        await dlq.ack(msg.receipt);
        moved++;
    }
    return moved;
}
