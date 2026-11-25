import { feesFor, type FeeSchedule } from "./feeSchedule.ts";

export interface OrderLine {
    sku: string;
    unitCents: number;
    qty: number;
}

export interface Order {
    id: string;
    zone: string;
    lines: OrderLine[];
}

export interface Quote {
    subtotalCents: number;
    deliveryCents: number;
    serviceCents: number;
    smallOrderCents: number;
    totalCents: number;
}

// Applies the conditions of this particular order (busy-period surge, basket size) to the zone's fees.
function adjustForOrder(fees: FeeSchedule, subtotalCents: number, surge: number): FeeSchedule {
    if (surge > 1) fees.deliveryCents = Math.round(fees.deliveryCents * surge);
    if (fees.freeDeliveryOverCents !== null && subtotalCents >= fees.freeDeliveryOverCents) fees.deliveryCents = 0;
    if (subtotalCents >= fees.smallOrderUnderCents) fees.smallOrderFeeCents = 0;
    return fees;
}

// What the customer pays. `surge` is the busy-period multiplier from dispatch (1 = normal).
export function quoteOrder(order: Order, surge = 1): Quote {
    if (order.lines.length === 0) throw new Error(`Order ${order.id} is empty`);
    if (!(surge >= 1 && surge <= 3)) throw new Error(`Surge multiplier ${surge} out of range`);
    const subtotalCents = order.lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);

    const fees = adjustForOrder(feesFor(order.zone), subtotalCents, surge);
    const serviceCents = Math.max(fees.minServiceFeeCents, Math.round(subtotalCents * fees.serviceFeeRate));

    return {
        subtotalCents,
        deliveryCents: fees.deliveryCents,
        serviceCents,
        smallOrderCents: fees.smallOrderFeeCents,
        totalCents: subtotalCents + fees.deliveryCents + serviceCents + fees.smallOrderFeeCents,
    };
}
