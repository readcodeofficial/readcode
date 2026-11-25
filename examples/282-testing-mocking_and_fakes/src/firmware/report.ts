import type { DeviceRegistry } from "./registry.ts";

export interface RolloutReport {
    total: number;
    onVersion: number;
    updating: number;
    retrying: number; // failed at least once, will be offered again
    quarantined: number;
}

// Dashboard numbers for one cohort's rollout of `version`.
export async function rolloutReport(registry: DeviceRegistry, cohort: string, version: string): Promise<RolloutReport> {
    const devices = await registry.listByCohort(cohort);
    return {
        total: devices.length,
        onVersion: devices.filter((d) => d.firmware === version).length,
        updating: devices.filter((d) => d.status === "updating").length,
        retrying: devices.filter((d) => d.status === "idle" && d.failures > 0).length,
        quarantined: devices.filter((d) => d.status === "quarantined").length,
    };
}
