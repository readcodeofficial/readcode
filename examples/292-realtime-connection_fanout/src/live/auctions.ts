import type { Hub } from "./hub.ts";

export interface Lot {
    id: string;
    title: string;
    highBidCents: number;
    highBidder: string | null;
    minIncrementCents: number;
    status: "open" | "sold";
}

export class BidRejected extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BidRejected";
    }
}

const roomFor = (lotId: string) => `lot:${lotId}`;

// Live auction: every accepted bid is pushed to everyone watching the lot.
export class Auctions {
    private readonly lots = new Map<string, Lot>();
    private readonly hub: Hub;

    constructor(hub: Hub, lots: Lot[]) {
        this.hub = hub;
        for (const lot of lots) this.lots.set(lot.id, { ...lot });
    }

    room(lotId: string): string {
        if (!this.lots.has(lotId)) throw new BidRejected(`unknown lot ${lotId}`);
        return roomFor(lotId);
    }

    placeBid(lotId: string, bidder: string, amountCents: number): number {
        const lot = this.lots.get(lotId);
        if (!lot) throw new BidRejected(`unknown lot ${lotId}`);
        if (lot.status !== "open") throw new BidRejected("lot is closed");
        const minimum = lot.highBidder === null ? lot.highBidCents : lot.highBidCents + lot.minIncrementCents;
        if (!Number.isInteger(amountCents) || amountCents < minimum) throw new BidRejected(`bid must be at least ${minimum}`);
        lot.highBidCents = amountCents;
        lot.highBidder = bidder;
        return this.hub.broadcast(roomFor(lotId), { type: "bid", lotId, amountCents, bidder });
    }

    hammer(lotId: string): number {
        const lot = this.lots.get(lotId);
        if (!lot || lot.status !== "open") throw new BidRejected(`lot ${lotId} is not open`);
        lot.status = "sold";
        return this.hub.broadcast(roomFor(lotId), { type: "sold", lotId, amountCents: lot.highBidCents, winner: lot.highBidder });
    }
}
