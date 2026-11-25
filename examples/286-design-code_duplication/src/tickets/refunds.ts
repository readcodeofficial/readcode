import type { EventInfo, PaymentProvider, Ticket, TicketStore } from "./types.ts";

const HOUR = 3_600_000;

export class NotRefundableError extends Error {
    constructor(ticketId: string, reason: string) {
        super(`Ticket ${ticketId} can't be refunded: ${reason}`);
        this.name = "NotRefundableError";
    }
}

function refundableCents(ticket: Ticket, event: EventInfo, now: Date): number {
    if (event.status === "cancelled") return ticket.priceCents + ticket.bookingFeeCents;
    const hoursLeft = (event.startsAt.getTime() - now.getTime()) / HOUR;
    if (hoursLeft >= 14 * 24) return ticket.priceCents;
    if (hoursLeft >= 72) return Math.round(ticket.priceCents / 2);
    return 0;
}

export class RefundService {
    private readonly store: TicketStore;
    private readonly payments: PaymentProvider;

    constructor(store: TicketStore, payments: PaymentProvider) {
        this.store = store;
        this.payments = payments;
    }

    // Customer pressed Return: send the money back and release the seat.
    async refund(ticketId: string, holderId: string, now: Date): Promise<Ticket> {
        const ticket = await this.store.ticket(ticketId);
        if (!ticket || ticket.holderId !== holderId) throw new NotRefundableError(ticketId, "not your ticket");
        if (ticket.refundedCents !== null) throw new NotRefundableError(ticketId, "already refunded");
        const event = await this.store.event(ticket.eventId);
        if (!event) throw new Error(`Unknown event ${ticket.eventId}`);

        const cents = refundableCents(ticket, event, now);
        if (cents <= 0) throw new NotRefundableError(ticketId, "outside the refund window");

        await this.payments.refund(ticket.paymentId, cents);
        const refunded: Ticket = { ...ticket, refundedCents: cents };
        await this.store.saveTicket(refunded);
        return refunded;
    }

    // Organiser cancelled the show: refund every ticket that hasn't been refunded yet.
    async refundCancelledEvent(tickets: Ticket[], now: Date): Promise<number> {
        let totalCents = 0;
        for (const t of tickets) {
            if (t.refundedCents !== null) continue;
            totalCents += (await this.refund(t.id, t.holderId, now)).refundedCents ?? 0;
        }
        return totalCents;
    }
}
