export interface EventInfo {
    id: string;
    name: string;
    startsAt: Date;
    status: "scheduled" | "cancelled";
}

export interface Ticket {
    id: string;
    eventId: string;
    holderId: string;
    tier: "standard" | "flex"; // flex tickets cost more and can be returned until shortly before the show
    priceCents: number;
    bookingFeeCents: number;
    paymentId: string;
    refundedCents: number | null; // null until the ticket is refunded
}

export interface TicketStore {
    ticket(id: string): Promise<Ticket | null>;
    event(id: string): Promise<EventInfo | null>;
    saveTicket(ticket: Ticket): Promise<void>;
}

export interface PaymentProvider {
    refund(paymentId: string, cents: number): Promise<void>;
}
