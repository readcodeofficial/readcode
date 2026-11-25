import type { Db, Row } from "../db.ts";

export type EventType = "opened" | "customer_message" | "agent_reply" | "closed";

export interface TicketEvent {
    id: string;
    ticketId: string;
    type: EventType;
    actor: string;
    body: string | null;
    at: Date;
}

const TABLE = "ticket_events";

function toEvent(row: Row): TicketEvent {
    return {
        id: String(row.id),
        ticketId: String(row.ticket_id),
        type: row.type as EventType,
        actor: String(row.actor),
        body: row.body === null ? null : String(row.body),
        at: new Date(String(row.at)),
    };
}

// Append-only log of everything that happens on a support ticket.
export class TicketEvents {
    private readonly db: Db;
    private readonly newId: () => string;

    constructor(db: Db, newId: () => string) {
        this.db = db;
        this.newId = newId;
    }

    async append(ticketId: string, type: EventType, actor: string, at: Date, body: string | null = null): Promise<TicketEvent> {
        const row: Row = { id: this.newId(), ticket_id: ticketId, type, actor, body, at: at.toISOString() };
        await this.db.insert(TABLE, row);
        return toEvent(row);
    }

    // Every event on the ticket, oldest first.
    async history(ticketId: string): Promise<TicketEvent[]> {
        const rows = await this.db.select(TABLE, { where: { ticket_id: ticketId } });
        return rows.map(toEvent);
    }

    async latest(ticketId: string): Promise<TicketEvent | null> {
        const [row] = await this.db.select(TABLE, { where: { ticket_id: ticketId }, orderBy: { column: "at", direction: "desc" }, limit: 1 });
        return row ? toEvent(row) : null;
    }
}
