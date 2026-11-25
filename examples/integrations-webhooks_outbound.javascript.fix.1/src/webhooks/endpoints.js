export function createEndpointRegistry() {
    const endpoints = new Map();
    return {
        register({ id, url, secret, events }) {
            endpoints.set(id, { id, url, secret, events: new Set(events) });
        },
        subscribedTo(eventType) {
            return [...endpoints.values()].filter((e) => e.events.has(eventType) || e.events.has("*"));
        },
        get: (id) => endpoints.get(id) ?? null,
    };
}
