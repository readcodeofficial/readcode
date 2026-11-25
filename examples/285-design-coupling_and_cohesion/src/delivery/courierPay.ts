import { feesFor } from "./feeSchedule.ts";

const MIN_DROP_PAY_CENTS = 200;

export interface Drop {
    orderId: string;
    zone: string;
    tipCents: number;
    surge: number;
}

// Courier earnings for one delivered order: their share of the zone's standard delivery fee,
// a surge bonus on top of that during busy periods, plus the whole tip. Free-delivery
// promotions are the platform's cost, so they don't reduce what the courier is paid.
export function courierPayout(drop: Drop): number {
    const fees = feesFor(drop.zone);
    const base = Math.round(fees.deliveryCents * fees.courierShare);
    const surgeBonus = Math.round(base * (drop.surge - 1));
    return Math.max(MIN_DROP_PAY_CENTS, base) + surgeBonus + drop.tipCents;
}
