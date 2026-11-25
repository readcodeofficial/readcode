import { allocate } from "./allocate.ts";

export interface PlanChange {
    oldPriceCents: number; // per billing period
    newPriceCents: number;
    daysInPeriod: number;
    daysUsed: number; // days already spent on the old plan
}

export interface ProrationLines {
    creditCents: number; // unused part of the old plan, given back
    chargeCents: number; // remaining part of the new plan
    netCents: number; // positive: customer pays; negative: credit balance
}

// Switching plans mid-period: split each price into used and unused days.
// Splitting with allocate() keeps used + unused exactly equal to the price.
export function prorate(change: PlanChange): ProrationLines {
    const { daysInPeriod, daysUsed } = change;
    if (!Number.isInteger(daysUsed) || daysUsed < 0 || daysUsed > daysInPeriod) throw new Error("daysUsed is out of range");
    const remaining = daysInPeriod - daysUsed;
    if (remaining === 0) return { creditCents: 0, chargeCents: 0, netCents: 0 };

    const [, oldUnused] = allocate(change.oldPriceCents, [daysUsed, remaining]);
    const [, newRemaining] = allocate(change.newPriceCents, [daysUsed, remaining]);
    return { creditCents: oldUnused, chargeCents: newRemaining, netCents: newRemaining - oldUnused };
}
