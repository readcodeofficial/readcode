import type { Batcher, Reading } from "./batcher.ts";

export interface DeviceRegistry {
    // Resolves the device for a token, or null if the token is unknown or revoked.
    lookup(token: string): Promise<{ deviceId: string } | null>;
}

export interface IngestRequest {
    token: string;
    readings: { metric: string; value: number; at: string }[];
}

export interface IngestResponse {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
}

// POST /ingest — devices send a handful of readings every few seconds.
export class IngestServer {
    private readonly registry: DeviceRegistry;
    private readonly batcher: Batcher;
    private accepting = true;
    private active = 0;
    private idleWaiters: (() => void)[] = [];

    constructor(registry: DeviceRegistry, batcher: Batcher) {
        this.registry = registry;
        this.batcher = batcher;
    }

    get inFlight(): number {
        return this.active;
    }

    async handle(req: IngestRequest): Promise<IngestResponse> {
        // Devices retry on 503 and their load balancer sends them to another instance.
        if (!this.accepting) return { status: 503, headers: { Connection: "close", "Retry-After": "1" } };
        this.active++;
        try {
            const device = await this.registry.lookup(req.token);
            if (!device) return { status: 401, body: { error: "unknown device token" } };
            if (!Array.isArray(req.readings) || req.readings.some((r) => !Number.isFinite(r.value))) {
                return { status: 400, body: { error: "readings must have numeric values" } };
            }
            const readings: Reading[] = req.readings.map((r) => ({ deviceId: device.deviceId, ...r }));
            this.batcher.add(readings);
            return { status: 202, body: { accepted: readings.length } };
        } finally {
            this.active--;
            if (this.active === 0) this.idleWaiters.splice(0).forEach((wake) => wake());
        }
    }

    stopAccepting(): void {
        this.accepting = false;
    }

    // Resolves once no request is being handled.
    drained(): Promise<void> {
        if (this.active === 0) return Promise.resolve();
        return new Promise((resolve) => this.idleWaiters.push(resolve));
    }
}
