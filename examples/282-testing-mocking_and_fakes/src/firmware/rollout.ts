import type { Device, DeviceRegistry } from "./registry.ts";

export const MAX_FAILURES = 3;

export type UpdateOutcome = { ok: true } | { ok: false; error: string };

// Over-the-air firmware rollout for connected thermostats, one cohort at a time.
export class FirmwareRollout {
    private readonly registry: DeviceRegistry;
    private readonly now: () => Date;

    constructor(registry: DeviceRegistry, now: () => Date) {
        this.registry = registry;
        this.now = now;
    }

    // Offers `version` to the next devices that are online, not on it yet, and not quarantined.
    async nextBatch(cohort: string, version: string, limit: number): Promise<Device[]> {
        const devices = await this.registry.listByCohort(cohort);
        const batch = devices
            .filter((d) => d.online && d.firmware !== version && d.status !== "quarantined")
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, limit);
        const offered: Device[] = [];
        for (const d of batch) {
            const updated: Device = { ...d, status: "updating", targetVersion: version, lastOfferedAt: this.now().toISOString() };
            await this.registry.save(updated);
            offered.push(updated);
        }
        return offered;
    }

    // Called when a device reports back after trying to install `version`.
    async recordResult(deviceId: string, version: string, outcome: UpdateOutcome): Promise<Device> {
        const device = await this.registry.get(deviceId);
        if (!device) throw new Error(`unknown device ${deviceId}`);
        // A late report from an earlier rollout must not overwrite the current one.
        if (device.targetVersion !== version) return device;

        if (outcome.ok) {
            const updated: Device = { ...device, firmware: version, status: "idle", targetVersion: null, failures: 0, lastError: null };
            await this.registry.save(updated);
            return updated;
        }

        device.failures += 1;
        device.lastError = outcome.error;
        device.targetVersion = null;
        if (device.failures >= MAX_FAILURES) {
            // Stop retrying; a technician has to look at it.
            device.status = "quarantined";
            await this.registry.save(device);
        } else {
            device.status = "idle";
        }
        return device;
    }
}
