import { Histogram } from "../metrics/histogram.ts";
import { Counter, fractionWithin } from "../metrics/registry.ts";

export interface BidRequest {
    id: string;
    exchange: string;
    floorCpm: number;
}

export interface Pricing {
    // Returns a CPM bid, or null to pass on the impression.
    price(req: BidRequest): Promise<number | null>;
}

export type Outcome = "bid" | "no_bid" | "below_floor" | "error";

// Exchanges drop any response slower than this, so the SLO is "bids answered within 100ms".
export const SLO_MS = 100;

export function createBidder(pricing: Pricing, clock: () => number) {
    const outcomes = new Counter("bidder_requests_total", "Bid requests by outcome", "outcome");
    const latency = new Histogram("bidder_latency_ms", "Time to answer a bid request", [10, 25, 50, SLO_MS, 250]);

    async function handle(req: BidRequest): Promise<{ bidCpm: number } | null> {
        const started = clock();
        let outcome: Outcome = "error";
        try {
            const cpm = await pricing.price(req);
            if (cpm === null) {
                outcome = "no_bid";
                return null;
            }
            if (cpm < req.floorCpm) {
                outcome = "below_floor";
                return null;
            }
            outcome = "bid";
            return { bidCpm: cpm };
        } finally {
            outcomes.inc(outcome);
            latency.observe(clock() - started);
        }
    }

    // Feeds the alert that pages on-call when fewer than 99% of requests meet the SLO.
    function sloReport() {
        const within = fractionWithin(latency.snapshot(), SLO_MS);
        return { withinSlo: within, breaching: within < 0.99 };
    }

    return { handle, sloReport, outcomes, latency };
}
