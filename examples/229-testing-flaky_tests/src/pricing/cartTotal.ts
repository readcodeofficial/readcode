import { quoteCart, type PriceSource } from "./quoteCart.ts";

export interface CartLine {
    sku: string;
    quantity: number;
}

export interface CartTotal {
    totalCents: number;
    unpriced: string[]; // SKUs we couldn't price; checkout is blocked while this is non-empty
}

export async function cartTotal(lines: CartLine[], source: PriceSource): Promise<CartTotal> {
    const quotes = await quoteCart(lines.map((l) => l.sku), source);
    let totalCents = 0;
    const unpriced: string[] = [];
    lines.forEach((line, i) => {
        const quote = quotes[i];
        if (quote.priceCents === null) unpriced.push(line.sku);
        else totalCents += quote.priceCents * line.quantity;
    });
    return { totalCents, unpriced };
}
