import { checkCoupon, systemClock, type Clock, type Coupon } from "./coupons.ts";

export interface StoredCoupon {
    coupon: Coupon;
    version: number;
}

export interface RedemptionStore {
    getCoupon(code: string): Promise<StoredCoupon | null>;
    // Saves only if the stored version still equals expectedVersion; returns false on a conflict.
    saveCoupon(coupon: Coupon, expectedVersion: number): Promise<boolean>;
    findRedemption(code: string, orderId: string): Promise<{ redeemedAt: string } | null>;
    addRedemption(code: string, orderId: string, redeemedAt: string): Promise<void>;
}

export type RedeemResult =
    | { ok: true; percentOff: number; alreadyRedeemed: boolean }
    | { ok: false; reason: "unknown_code" | "not_started" | "expired" | "exhausted" | "conflict" };

const MAX_ATTEMPTS = 3;

// Called when an order is placed. Redeeming the same order twice (a retried request) counts once.
export async function redeemCoupon(
    store: RedemptionStore,
    code: string,
    orderId: string,
    clock: Clock = systemClock,
): Promise<RedeemResult> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const stored = await store.getCoupon(code);
        if (!stored) return { ok: false, reason: "unknown_code" };

        if (await store.findRedemption(code, orderId)) {
            return { ok: true, percentOff: stored.coupon.percentOff, alreadyRedeemed: true };
        }

        const check = checkCoupon(stored.coupon, clock);
        if (!check.ok) return { ok: false, reason: check.reason };

        const updated: Coupon = { ...stored.coupon, redemptions: stored.coupon.redemptions + 1 };
        if (await store.saveCoupon(updated, stored.version)) {
            await store.addRedemption(code, orderId, clock().toISOString());
            return { ok: true, percentOff: check.percentOff, alreadyRedeemed: false };
        }
        // another checkout redeemed the same coupon in between: re-read and try again
    }
    return { ok: false, reason: "conflict" };
}
