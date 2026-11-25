import type { Pacer } from "./pacing.ts";
import type { Bid, BidRequest, Campaign, Matcher, RuleCompiler } from "./types.ts";

interface CompiledRule {
    version: number;
    matches: Matcher;
}

export interface BidderStats {
    requests: number;
    bids: number;
    rulesCompiled: number;
}

// Answers bid requests from the exchange. This runs for every ad slot on every page view
// (tens of thousands per second per instance) and has a ~10 ms budget.
export class Bidder {
    private readonly campaigns: () => Campaign[];
    private readonly compile: RuleCompiler;
    private readonly pacer: Pacer;
    private readonly counters: BidderStats = { requests: 0, bids: 0, rulesCompiled: 0 };

    constructor(campaigns: () => Campaign[], compile: RuleCompiler, pacer: Pacer) {
        this.campaigns = campaigns;
        this.compile = compile;
        this.pacer = pacer;
    }

    bid(req: BidRequest): Bid | null {
        this.counters.requests++;
        const compiled = new Map<string, CompiledRule>();
        const ruleFor = (c: Campaign): Matcher => {
            let entry = compiled.get(c.id);
            if (!entry || entry.version !== c.version) {
                entry = { version: c.version, matches: this.compile(c.rule) };
                compiled.set(c.id, entry);
                this.counters.rulesCompiled++;
            }
            return entry.matches;
        };

        let best: Campaign | null = null;
        for (const c of this.campaigns()) {
            if (c.status !== "active" || c.bidCents < req.floorCents) continue;
            if (best && c.bidCents <= best.bidCents) continue;
            if (!this.pacer.canAfford(c.id, c.bidCents, c.dailyBudgetCents)) continue;
            if (ruleFor(c)(req)) best = c;
        }
        if (!best) return null;

        this.pacer.record(best.id, best.bidCents);
        this.counters.bids++;
        return { requestId: req.id, campaignId: best.id, priceCents: best.bidCents };
    }

    stats(): BidderStats {
        return { ...this.counters };
    }
}
