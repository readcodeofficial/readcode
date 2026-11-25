import type { Delivery, InMemoryBroker } from "../queue/broker.ts";
import type { DedupStore, PointsLedger, Purchase } from "./purchases.ts";

export const POINTS_PER_UNIT = 1; // one point per whole dollar/euro spent

export interface ConsumerStats {
    awarded: number;
    duplicates: number;
    failed: number;
}

// Awards loyalty points for PurchaseCompleted events. The bus delivers at least once and checkout
// may publish an order more than once, so each event is claimed in the dedup store before awarding.
export class PointsConsumer {
    private readonly broker: InMemoryBroker;
    private readonly ledger: PointsLedger;
    private readonly dedup: DedupStore;
    private readonly now: () => number;
    readonly stats: ConsumerStats = { awarded: 0, duplicates: 0, failed: 0 };

    constructor(broker: InMemoryBroker, ledger: PointsLedger, dedup: DedupStore, now: () => number) {
        this.broker = broker;
        this.ledger = ledger;
        this.dedup = dedup;
        this.now = now;
    }

    private dedupKey(msg: Delivery): string {
        return msg.id;
    }

    async handle(msg: Delivery): Promise<void> {
        const key = this.dedupKey(msg);
        if (!this.dedup.claim(key, this.now())) {
            this.stats.duplicates++;
            await this.broker.ack(msg.receipt);
            return;
        }
        try {
            const purchase = JSON.parse(msg.body) as Purchase;
            await this.ledger.award(purchase.memberId, Math.floor(purchase.amountCents / 100) * POINTS_PER_UNIT);
        } catch (err) {
            // Not handled after all: let a redelivery claim it again.
            this.dedup.release(key);
            this.stats.failed++;
            await this.broker.nack(msg.receipt);
            return;
        }
        this.stats.awarded++;
        await this.broker.ack(msg.receipt);
    }

    async drain(maxRounds = 100): Promise<void> {
        for (let i = 0; i < maxRounds; i++) {
            const batch = await this.broker.receive(10);
            if (batch.length === 0) return;
            for (const msg of batch) await this.handle(msg);
        }
    }
}
