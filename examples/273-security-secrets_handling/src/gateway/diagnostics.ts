import type { GatewayConfig } from "./config.ts";
import { redact } from "./redact.ts";

// GET /debug/status on the gateway's local admin port. Field technicians screenshot this page
// and attach it to support tickets.
export function diagnosticsReport(config: GatewayConfig, startedAt: Date, now: Date, queuedReadings: number) {
    return {
        status: queuedReadings > 10_000 ? "degraded" : "ok",
        uptimeSeconds: Math.floor((now.getTime() - startedAt.getTime()) / 1000),
        queuedReadings,
        config: redact(config),
    };
}

// First line the gateway writes at boot; shipped to the central log store.
export function startupLogLine(config: GatewayConfig, version: string): string {
    return JSON.stringify({ level: "info", msg: "gateway starting", version, config: redact(config) });
}
