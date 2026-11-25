import type { TicketEvent } from "./events.ts";

export interface SlaPolicy {
    firstResponseMinutes: number;
}

export interface FirstResponse {
    dueAt: Date;
    respondedAfterMinutes: number | null;
    breached: boolean;
}

// First-response SLA: an agent must reply within the window after the ticket is opened.
export function firstResponse(history: TicketEvent[], policy: SlaPolicy, now: Date): FirstResponse {
    const opened = history.find((e) => e.type === "opened");
    if (!opened) throw new Error("ticket has no opened event");
    const dueAt = new Date(opened.at.getTime() + policy.firstResponseMinutes * 60_000);
    const reply = history.find((e) => e.type === "agent_reply");
    if (!reply) return { dueAt, respondedAfterMinutes: null, breached: now > dueAt };
    return {
        dueAt,
        respondedAfterMinutes: Math.round((reply.at.getTime() - opened.at.getTime()) / 60_000),
        breached: reply.at > dueAt,
    };
}
