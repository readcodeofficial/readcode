import { refundAmountCents, refundPercent } from "./policy.ts";
import type { TicketStore } from "./types.ts";

export interface RefundPreview {
    ticketId: string;
    refundable: boolean;
    percent: number;
    amountCents: number;
    message: string;
}

const euros = (cents: number) => `€${(cents / 100).toFixed(2)}`;

// Shown on the "My tickets" page next to the Return button.
export async function previewRefund(store: TicketStore, ticketId: string, now: Date): Promise<RefundPreview> {
    const ticket = await store.ticket(ticketId);
    if (!ticket) throw new Error(`Unknown ticket ${ticketId}`);
    const event = await store.event(ticket.eventId);
    if (!event) throw new Error(`Unknown event ${ticket.eventId}`);

    if (ticket.refundedCents !== null) {
        return { ticketId, refundable: false, percent: 0, amountCents: 0, message: `Already refunded ${euros(ticket.refundedCents)}` };
    }
    const percent = refundPercent(ticket, event, now);
    const amountCents = refundAmountCents(ticket, event, now);
    return {
        ticketId,
        refundable: amountCents > 0,
        percent,
        amountCents,
        message: amountCents > 0 ? `Return now for ${euros(amountCents)} back` : "This ticket can no longer be refunded",
    };
}
