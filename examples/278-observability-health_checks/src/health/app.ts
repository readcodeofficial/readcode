import { HealthService } from "./health.ts";
import { databaseCheck, thumbnailOriginCheck, type CdnOrigin, type Database } from "./checks.ts";

export interface Catalog {
    load(): Promise<number>; // number of titles loaded into memory
}

export interface Probe {
    status: number;
    body: { status: string; reason?: string; checks: { name: string; ok: boolean; error?: string }[] };
}

// Wires the playback service's health endpoints. Kubernetes polls /livez and /readyz.
export function playbackHealth(deps: { db: Database; origin: CdnOrigin; catalog: Catalog; timeoutMs?: number }) {
    const health = new HealthService(deps.timeoutMs);
    health.register(databaseCheck(deps.db));
    health.register(thumbnailOriginCheck(deps.origin));

    const probe = async (report: ReturnType<HealthService["live"]>): Promise<Probe> => {
        const r = await report;
        return { status: r.status === "down" ? 503 : 200, body: r };
    };

    return {
        // Warm the in-memory catalog before taking traffic.
        async boot(): Promise<void> {
            const titles = await deps.catalog.load();
            if (titles === 0) throw new Error("catalog is empty");
            health.markStarted();
        },
        // The DRM key store got into a state we can't recover from without restarting.
        onLicenseKeysCorrupted(): void {
            health.markFatal("license keys corrupted");
        },
        onSigterm(): void {
            health.markDraining();
        },
        livez: () => probe(health.live()),
        readyz: () => probe(health.ready()),
    };
}
