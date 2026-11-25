import type { TicketEvents } from "./events.ts";
import { firstResponse, type FirstResponse, type SlaPolicy } from "./sla.ts";

export type TicketStatus = "awaiting_agent" | "awaiting_customer" | "closed";

export class TicketService {
    private readonly events: TicketEvents;
    private readonly now: () => Date;

    constructor(events: TicketEvents, now: () => Date) {
        this.events = events;
        this.now = now;
    }

    async open(ticketId: string, customer: string, body: string): Promise<void> {
        await this.events.append(ticketId, "opened", customer, this.now(), body);
    }

    async customerMessage(ticketId: string, customer: string, body: string): Promise<void> {
        await this.events.append(ticketId, "customer_message", customer, this.now(), body);
    }

    async agentReply(ticketId: string, agent: string, body: string): Promise<void> {
        await this.events.append(ticketId, "agent_reply", agent, this.now(), body);
    }

    async close(ticketId: string, agent: string): Promise<void> {
        await this.events.append(ticketId, "closed", agent, this.now());
    }

    async status(ticketId: string): Promise<TicketStatus> {
        const last = await this.events.latest(ticketId);
        if (!last) throw new Error(`unknown ticket ${ticketId}`);
        if (last.type === "closed") return "closed";
        return last.type === "agent_reply" ? "awaiting_customer" : "awaiting_agent";
    }

    // Lines for the agent console, e.g. "09:05 agent:sam agent_reply".
    async timeline(ticketId: string): Promise<string[]> {
        const history = await this.events.history(ticketId);
        return history.map((e) => `${e.at.toISOString().slice(11, 16)} ${e.actor} ${e.type}`);
    }

    async sla(ticketId: string, policy: SlaPolicy): Promise<FirstResponse> {
        return firstResponse(await this.events.history(ticketId), policy, this.now());
    }
}
