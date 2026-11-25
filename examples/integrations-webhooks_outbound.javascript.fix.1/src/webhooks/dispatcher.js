import { sign, signatureHeader } from "./signing.js";

const RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000];

export function createDispatcher({ registry, transport, clock, sleep }) {
    const log = [];

    async function deliver(endpoint, event) {
        const body = JSON.stringify({ id: event.id, type: event.type, data: event.data });
        const timestamp = Math.floor(clock.now() / 1000);
        const signature = sign(endpoint.secret, timestamp, body);

        for (let attempt = 1; attempt <= RETRY_BACKOFF_MS.length + 1; attempt++) {
            let status;
            try {
                const res = await transport.post(endpoint.url, {
                    headers: {
                        "content-type": "application/json",
                        "webhook-id": event.id,
                        "webhook-signature": signatureHeader(timestamp, signature),
                    },
                    body,
                });
                status = res.status;
            } catch {
                status = 0;
            }
            log.push({ endpointId: endpoint.id, eventId: event.id, attempt, status });
            if (status >= 200 && status < 300) return { delivered: true, attempts: attempt };
            if (status >= 400 && status < 500 && status !== 429) return { delivered: false, attempts: attempt };
            if (attempt <= RETRY_BACKOFF_MS.length) await sleep(RETRY_BACKOFF_MS[attempt - 1]);
        }
        return { delivered: false, attempts: RETRY_BACKOFF_MS.length + 1 };
    }

    return {
        async publish(event) {
            const targets = registry.subscribedTo(event.type);
            return Promise.all(targets.map((endpoint) => deliver(endpoint, event)));
        },
        log: () => log.map((l) => ({ ...l })),
    };
}
