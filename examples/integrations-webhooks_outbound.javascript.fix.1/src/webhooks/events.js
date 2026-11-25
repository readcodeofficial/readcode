// Builds the event envelopes that billing code publishes to subscribers.
let counter = 0;

export function nextEventId(prefix = "evt") {
    counter += 1;
    return `${prefix}_${String(counter).padStart(6, "0")}`;
}

export function invoicePaid(invoice) {
    return {
        id: nextEventId(),
        type: "invoice.paid",
        data: {
            invoice: invoice.id,
            customer: invoice.customerId,
            amountCents: invoice.amountCents,
            currency: invoice.currency ?? "usd",
        },
    };
}

export function customerCreated(customer) {
    return {
        id: nextEventId(),
        type: "customer.created",
        data: { customer: customer.id, email: customer.email },
    };
}

export function summarize(results) {
    const delivered = results.filter((r) => r.delivered).length;
    return { total: results.length, delivered, failed: results.length - delivered };
}
