import type { PromoRedeemer, RedeemResult } from "./redemptions.ts";

export interface Order {
    id: string;
    customerId: string;
    subtotalCents: number;
    deliveryFeeCents: number;
    promo?: { code: string; discountCents: number };
    status: "placed" | "cancelled";
}

export interface PlacedOrder {
    order: Order;
    promo: RedeemResult | null;
    totalCents: number;
}

// Promo discounts apply to the food subtotal, never to the delivery fee.
export async function placeOrder(promos: PromoRedeemer, order: Order, promoCode: string | undefined, now: Date): Promise<PlacedOrder> {
    let promo: RedeemResult | null = null;
    if (promoCode) {
        promo = await promos.redeem(promoCode, order.customerId, order.id, order.subtotalCents, now);
        if (promo.ok) order.promo = { code: promo.code, discountCents: promo.discountCents };
    }
    const totalCents = order.subtotalCents - (order.promo?.discountCents ?? 0) + order.deliveryFeeCents;
    return { order, promo, totalCents };
}

export async function cancelOrder(promos: PromoRedeemer, order: Order): Promise<void> {
    if (order.status === "cancelled") return;
    order.status = "cancelled";
    if (order.promo) await promos.release(order.promo.code, order.customerId, order.id);
}
