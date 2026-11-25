import type { WalletService } from "./wallets.ts";

export interface Order {
    id: string;
    buyerId: string;
    sellerId: string;
    amountCents: number;
    refundedCents: number;
}

export interface OrderStore {
    get(id: string): Promise<Order | null>;
    save(order: Order): Promise<void>;
}

// Refund part or all of an order: money moves back from the seller's wallet to the buyer's.
export async function refundOrder(
    orders: OrderStore,
    wallets: Pick<WalletService, "transfer">,
    orderId: string,
    amountCents: number,
): Promise<Order> {
    const order = await orders.get(orderId);
    if (!order) throw new Error(`Unknown order ${orderId}`);

    const refundable = order.amountCents - order.refundedCents;
    if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Refund must be a positive number of cents");
    if (amountCents > refundable) throw new Error(`Only ${refundable} cents of order ${orderId} can still be refunded`);

    await wallets.transfer(order.sellerId, order.buyerId, amountCents);
    const updated = { ...order, refundedCents: order.refundedCents + amountCents };
    await orders.save(updated);
    return updated;
}
