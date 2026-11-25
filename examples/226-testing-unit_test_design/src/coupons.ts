export interface Coupon {
    code: string;
    percentOff: number; // 1..100
    startsAt: string; // ISO timestamp
    expiresAt: string | null; // null = never expires
    maxRedemptions: number | null; // null = unlimited
    redemptions: number;
}

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

export type CouponCheck =
    | { ok: true; percentOff: number }
    | { ok: false; reason: "not_started" | "expired" | "exhausted" };

export function checkCoupon(coupon: Coupon, clock: Clock = systemClock): CouponCheck {
    const now = clock().getTime();
    if (now < Date.parse(coupon.startsAt)) {
        return { ok: false, reason: "not_started" };
    }
    if (coupon.expiresAt !== null && Date.now() >= Date.parse(coupon.expiresAt)) {
        return { ok: false, reason: "expired" };
    }
    if (coupon.maxRedemptions !== null && coupon.redemptions >= coupon.maxRedemptions) {
        return { ok: false, reason: "exhausted" };
    }
    return { ok: true, percentOff: coupon.percentOff };
}

export interface PricedCart {
    subtotalCents: number;
    discountCents: number;
    totalCents: number;
    rejected: "not_started" | "expired" | "exhausted" | null;
}

export function applyCoupon(subtotalCents: number, coupon: Coupon, clock: Clock = systemClock): PricedCart {
    const check = checkCoupon(coupon, clock);
    if (!check.ok) {
        return { subtotalCents, discountCents: 0, totalCents: subtotalCents, rejected: check.reason };
    }
    const discountCents = Math.floor((subtotalCents * check.percentOff) / 100);
    return { subtotalCents, discountCents, totalCents: subtotalCents - discountCents, rejected: null };
}
