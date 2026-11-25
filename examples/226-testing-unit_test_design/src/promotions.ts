import { checkCoupon, systemClock, type Clock, type Coupon } from "./coupons.ts";

export interface PromoBanner {
    code: string;
    headline: string;
    endsAt: string | null;
}

// Coupons that can be used right now, best discount first.
export function activeCoupons(coupons: Coupon[], clock: Clock = systemClock): Coupon[] {
    // read the clock once, so every coupon is judged at the same instant
    const now = clock();
    const at: Clock = () => now;
    return coupons
        .filter((c) => checkCoupon(c, at).ok)
        .sort((a, b) => b.percentOff - a.percentOff || a.code.localeCompare(b.code));
}

// Homepage banners: at most `limit` active promotions.
export function promoBanners(coupons: Coupon[], limit: number, clock: Clock = systemClock): PromoBanner[] {
    return activeCoupons(coupons, clock)
        .slice(0, limit)
        .map((c) => ({ code: c.code, headline: `${c.percentOff}% off with ${c.code}`, endsAt: c.expiresAt }));
}
