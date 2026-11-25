import type { AuditEntry } from "./changeRoles.ts";

export interface AuditFilter {
    actorId?: string;
    targetId?: string;
    actionPrefix?: string; // e.g. "user." for every user-management action
    outcome?: AuditEntry["outcome"];
    from?: string; // ISO timestamp, inclusive
    to?: string; // ISO timestamp, exclusive
}

// Investigation screen: newest first, at most `limit` entries.
export function searchAudit(entries: readonly AuditEntry[], filter: AuditFilter, limit = 50): AuditEntry[] {
    const from = filter.from ? Date.parse(filter.from) : -Infinity;
    const to = filter.to ? Date.parse(filter.to) : Infinity;
    return entries
        .filter((e) => {
            const at = Date.parse(e.at);
            return (
                at >= from &&
                at < to &&
                (!filter.actorId || e.actorId === filter.actorId) &&
                (!filter.targetId || e.targetId === filter.targetId) &&
                (!filter.actionPrefix || e.action.startsWith(filter.actionPrefix)) &&
                (!filter.outcome || e.outcome === filter.outcome)
            );
        })
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, Math.max(0, limit));
}

// "Who touched this account?": distinct actors, with how many actions each.
export function actorsFor(entries: readonly AuditEntry[], targetId: string): { actorId: string; actions: number }[] {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.targetId === targetId) counts.set(e.actorId, (counts.get(e.actorId) ?? 0) + 1);
    return [...counts].map(([actorId, actions]) => ({ actorId, actions })).sort((a, b) => b.actions - a.actions || a.actorId.localeCompare(b.actorId));
}
