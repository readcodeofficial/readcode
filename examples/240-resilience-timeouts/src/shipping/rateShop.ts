import type { Carrier, Quote, Shipment } from "./carriers.ts";
import { TimeoutError, withTimeout } from "./timeout.ts";

export interface Skipped {
    carrier: string;
    reason: "timeout" | "error";
    message: string;
}

export interface RateShopResult {
    best: Quote;
    quotes: Quote[]; // cheapest first
    skipped: Skipped[];
}

export class NoRatesError extends Error {
    readonly skipped: Skipped[];

    constructor(skipped: Skipped[]) {
        super(`No carrier returned a rate (${skipped.map((s) => `${s.carrier}: ${s.reason}`).join(", ")})`);
        this.name = "NoRatesError";
        this.skipped = skipped;
    }
}

// Asks every carrier at once during checkout. A carrier that is slow or failing is skipped
// rather than holding up the customer.
export class RateShopper {
    private readonly carriers: Carrier[];
    private readonly perCarrierMs: number;

    constructor(carriers: Carrier[], perCarrierMs = 800) {
        this.carriers = carriers;
        this.perCarrierMs = perCarrierMs;
    }

    async shop(shipment: Shipment): Promise<RateShopResult> {
        const settled = await Promise.allSettled(
            this.carriers.map((c) => withTimeout(`${c.name} rate`, this.perCarrierMs, (signal) => c.quote(shipment, signal))),
        );
        const quotes: Quote[] = [];
        const skipped: Skipped[] = [];
        settled.forEach((r, i) => {
            if (r.status === "fulfilled") quotes.push(r.value);
            else skipped.push({ carrier: this.carriers[i].name, reason: r.reason instanceof TimeoutError ? "timeout" : "error", message: String(r.reason?.message ?? r.reason) });
        });
        if (quotes.length === 0) throw new NoRatesError(skipped);
        quotes.sort((a, b) => a.priceCents - b.priceCents || a.transitDays - b.transitDays);
        return { best: quotes[0], quotes, skipped };
    }
}
