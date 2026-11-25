import { applyCoupon, systemClock, type Clock, type Coupon, type PricedCart } from "./coupons.ts";

export interface CouponRepo {
    find(code: string): Promise<Coupon | null>;
}

export interface CartLine {
    sku: string;
    unitPriceCents: number;
    quantity: number;
}

export async function priceCart(
    lines: CartLine[],
    couponCode: string | undefined,
    coupons: CouponRepo,
    clock: Clock = systemClock,
): Promise<PricedCart> {
    const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
    if (!couponCode) {
        return { subtotalCents, discountCents: 0, totalCents: subtotalCents, rejected: null };
    }
    const coupon = await coupons.find(couponCode.trim().toUpperCase());
    if (!coupon) {
        return { subtotalCents, discountCents: 0, totalCents: subtotalCents, rejected: "expired" };
    }
    return applyCoupon(subtotalCents, coupon, clock);
}
