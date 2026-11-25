import { newSessionId } from "./ids.js";

export function createSessionManager({ store, now, generateId = newSessionId }) {
    function start() {
        const id = generateId();
        const t = now();
        store.put(id, { userId: null, data: {}, createdAt: t, lastSeen: t });
        return id;
    }

    return {
        start,

        resolve(id) {
            return id ? store.get(id) : null;
        },

        login(id, userId) {
            const session = id ? store.get(id) : null;
            if (!session) {
                const fresh = start();
                store.get(fresh).userId = userId;
                return fresh;
            }
            session.userId = userId;
            session.data.loggedInAt = now();
            return id;
        },

        logout(id) {
            store.delete(id);
        },
    };
}
