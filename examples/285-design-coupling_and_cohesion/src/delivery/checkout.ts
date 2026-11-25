import { courierPayout } from "./courierPay.ts";
import { quoteOrder, type Order, type Quote } from "./quote.ts";

export interface PaymentGateway {
    charge(orderId: string, cents: number): Promise<void>;
}

export interface Settlement {
    orderId: string;
    quote: Quote;
    chargedCents: number;
    courierCents: number;
    platformCents: number;
}

// Charges the customer the quoted total (plus tip) and works out who gets what.
export async function checkout(gateway: PaymentGateway, order: Order, surge: number, tipCents: number): Promise<Settlement> {
    if (!Number.isInteger(tipCents) || tipCents < 0) throw new Error("Tip must be a non-negative number of cents");
    const quote = quoteOrder(order, surge);
    const chargedCents = quote.totalCents + tipCents;
    await gateway.charge(order.id, chargedCents);

    const courierCents = courierPayout({ orderId: order.id, zone: order.zone, tipCents, surge });
    return {
        orderId: order.id,
        quote,
        chargedCents,
        courierCents,
        platformCents: chargedCents - quote.subtotalCents - courierCents,
    };
}
