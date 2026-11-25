export function createSessionStore({ now, idleMs = 15 * 60_000, absoluteMs = 8 * 3_600_000 }) {
    const rows = new Map();
    return {
        put(id, session) {
            rows.set(id, session);
        },
        get(id) {
            const session = rows.get(id);
            if (!session) return null;
            const t = now();
            if (t - session.lastSeen > idleMs || t - session.createdAt > absoluteMs) {
                rows.delete(id);
                return null;
            }
            session.lastSeen = t;
            return session;
        },
        delete(id) {
            return rows.delete(id);
        },
        size() {
            return rows.size;
        },
    };
}
