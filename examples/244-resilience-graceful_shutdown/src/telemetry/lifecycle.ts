import type { Batcher, TimeseriesSink } from "./batcher.ts";
import type { IngestServer } from "./server.ts";

export interface ShutdownReport {
    inFlightAtStart: number;
    drained: boolean; // false if requests were still running when the drain timeout hit
}

async function within(work: Promise<void>, ms: number): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<false>((resolve) => (timer = setTimeout(() => resolve(false), ms)));
    try {
        return await Promise.race([work.then(() => true as const), timeout]);
    } finally {
        clearTimeout(timer);
    }
}

// Called on SIGTERM when the orchestrator rolls the ingest fleet. The process exits once the
// returned promise settles, so everything acknowledged with a 202 must be stored by then.
export class Lifecycle {
    private readonly server: IngestServer;
    private readonly batcher: Batcher;
    private readonly sink: TimeseriesSink;
    private readonly drainTimeoutMs: number;
    private stopping: Promise<ShutdownReport> | null = null;

    constructor(server: IngestServer, batcher: Batcher, sink: TimeseriesSink, drainTimeoutMs = 10_000) {
        this.server = server;
        this.batcher = batcher;
        this.sink = sink;
        this.drainTimeoutMs = drainTimeoutMs;
    }

    // Safe to call more than once (SIGTERM followed by SIGINT, say): every caller gets the same run.
    shutdown(): Promise<ShutdownReport> {
        this.stopping ??= this.run();
        return this.stopping;
    }

    private async run(): Promise<ShutdownReport> {
        const inFlightAtStart = this.server.inFlight;
        this.server.stopAccepting();
        await this.batcher.flush();
        const drained = await within(this.server.drained(), this.drainTimeoutMs);
        await this.sink.close();
        return { inFlightAtStart, drained };
    }
}
