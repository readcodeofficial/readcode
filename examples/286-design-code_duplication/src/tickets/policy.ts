import type { EventInfo, Ticket } from "./types.ts";

const HOUR = 3_600_000;

// The published refund policy (terms of sale, section 7):
// - organiser cancels the event: full refund including the booking fee
// - flex tickets: 100% up to 24 hours before the start, 50% after that until the start
// - standard tickets: 100% up to 14 days before, 50% up to 72 hours before, nothing after
// Booking fees are only refunded when the organiser cancels.
export function refundPercent(ticket: Ticket, event: EventInfo, now: Date): number {
    if (event.status === "cancelled") return 100;
    const hoursLeft = (event.startsAt.getTime() - now.getTime()) / HOUR;
    if (hoursLeft <= 0) return 0;
    if (ticket.tier === "flex") return hoursLeft >= 24 ? 100 : 50;
    if (hoursLeft >= 14 * 24) return 100;
    if (hoursLeft >= 72) return 50;
    return 0;
}

export function refundAmountCents(ticket: Ticket, event: EventInfo, now: Date): number {
    const face = Math.round((ticket.priceCents * refundPercent(ticket, event, now)) / 100);
    return event.status === "cancelled" ? face + ticket.bookingFeeCents : face;
}
