import type { PartitionedTopic } from "../bus/topic.ts";
import type { OrderStatus, StatusEvent } from "./statusPublisher.ts";

const MESSAGES: Record<OrderStatus, string> = {
    placed: "We've sent your order to the restaurant",
    accepted: "The restaurant accepted your order",
    preparing: "Your food is being prepared",
    picked_up: "Your courier is on the way",
    delivered: "Enjoy your meal!",
    cancelled: "Your order was cancelled",
};

// Builds the customer's live tracking page and push notifications from the status topic.
// It trusts the topic's per-order ordering: each event becomes the order's current status.
export class TrackingProjection {
    private readonly topic: PartitionedTopic<StatusEvent>;
    private readonly offsets: number[];
    private readonly current = new Map<string, StatusEvent>();
    private readonly timelines = new Map<string, OrderStatus[]>();
    private readonly push: (orderId: string, text: string) => void;

    constructor(topic: PartitionedTopic<StatusEvent>, push: (orderId: string, text: string) => void) {
        this.topic = topic;
        this.push = push;
        this.offsets = topic.partitions.map(() => 0);
    }

    poll(): number {
        let applied = 0;
        this.offsets.forEach((from, p) => {
            for (const event of this.topic.read(p, from)) {
                this.current.set(event.orderId, event);
                this.timelines.set(event.orderId, [...(this.timelines.get(event.orderId) ?? []), event.status]);
                this.push(event.orderId, MESSAGES[event.status]);
                this.offsets[p]++;
                applied++;
            }
        });
        return applied;
    }

    statusOf(orderId: string): OrderStatus | undefined {
        return this.current.get(orderId)?.status;
    }

    timeline(orderId: string): OrderStatus[] {
        return this.timelines.get(orderId) ?? [];
    }
}
