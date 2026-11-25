import { cartTotal, type CartLine } from "./cartTotal.ts";
import type { PriceSource } from "./quoteCart.ts";

export type CheckoutSummary =
    | { ok: true; subtotalCents: number; taxCents: number; totalCents: number }
    | { ok: false; reason: "empty_cart" | "unpriced_items"; skus: string[] };

// Shown on the order review page. Tax is rounded half up to whole cents.
export async function checkoutSummary(lines: CartLine[], source: PriceSource, taxRateBps: number): Promise<CheckoutSummary> {
    const items = lines.filter((l) => l.quantity > 0);
    if (items.length === 0) return { ok: false, reason: "empty_cart", skus: [] };

    const { totalCents: subtotalCents, unpriced } = await cartTotal(items, source);
    if (unpriced.length > 0) return { ok: false, reason: "unpriced_items", skus: unpriced };

    const taxCents = Math.floor((subtotalCents * taxRateBps + 5_000) / 10_000);
    return { ok: true, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
