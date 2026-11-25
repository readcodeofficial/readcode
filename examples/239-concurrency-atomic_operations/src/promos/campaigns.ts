export interface Campaign {
    code: string;
    percentOff: number; // 1-100
    maxDiscountCents: number;
    minOrderCents: number;
    maxRedemptions: number; // across all customers
    expiresAt: Date;
}

export type Rejection = "unknown_code" | "expired" | "below_minimum" | "already_used" | "sold_out";

export class CampaignCatalog {
    private readonly byCode = new Map<string, Campaign>();

    add(c: Campaign): void {
        if (c.percentOff < 1 || c.percentOff > 100) throw new Error(`Invalid percentOff for ${c.code}`);
        this.byCode.set(c.code.toUpperCase(), c);
    }

    find(code: string): Campaign | undefined {
        return this.byCode.get(code.trim().toUpperCase());
    }
}

// Checks that don't depend on how many times the code was used.
export function checkEligibility(c: Campaign | undefined, orderCents: number, now: Date): Rejection | null {
    if (!c) return "unknown_code";
    if (now >= c.expiresAt) return "expired";
    if (orderCents < c.minOrderCents) return "below_minimum";
    return null;
}

export function discountFor(c: Campaign, orderCents: number): number {
    return Math.min(c.maxDiscountCents, Math.floor((orderCents * c.percentOff) / 100));
}
