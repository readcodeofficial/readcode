import type { Limiter } from "./limiter.ts";
import { DeadlineExceededError, withDeadline } from "./signals.ts";
import { normalizeOffers, type FlightQuery, type Offer, type Supplier } from "./suppliers.ts";

export interface SearchResult {
    offers: Offer[]; // cheapest first
    timedOut: string[];
    failed: string[];
}

// Fans a flight search out to every supplier and merges what comes back within the budget.
// requestSignal aborts when the client disconnects; then there is nobody to answer.
export class FlightSearch {
    private readonly suppliers: Supplier[];
    private readonly limiter: Limiter;
    private readonly budgetMs: number;

    constructor(suppliers: Supplier[], limiter: Limiter, budgetMs: number) {
        this.suppliers = suppliers;
        this.limiter = limiter;
        this.budgetMs = budgetMs;
    }

    async search(query: FlightQuery, requestSignal: AbortSignal): Promise<SearchResult> {
        const release = await this.limiter.acquire();
        const scope = withDeadline(requestSignal, this.budgetMs);
        try {
            const settled = await Promise.allSettled(this.suppliers.map((s) => s.search(query, scope.signal)));
            if (requestSignal.aborted) throw requestSignal.reason;

            const result: SearchResult = { offers: [], timedOut: [], failed: [] };
            settled.forEach((outcome, i) => {
                const name = this.suppliers[i].name;
                if (outcome.status === "fulfilled") result.offers.push(...normalizeOffers(name, outcome.value));
                else if (outcome.reason instanceof DeadlineExceededError) result.timedOut.push(name);
                else result.failed.push(name);
            });
            result.offers.sort((a, b) => a.priceCents - b.priceCents || a.departs.localeCompare(b.departs));
            return result;
        } finally {
            scope.dispose();
            release();
        }
    }
}
