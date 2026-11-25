import { QuorumError, type QuorumStore } from "../replication/quorum.ts";

export interface DeviceConfig {
    firmware: string;
    reportEverySec: number;
}

// What a device runs until it has been given a config of its own.
export const FACTORY_CONFIG: DeviceConfig = { firmware: "1.0.0", reportEverySec: 300 };

export interface RolloutReport {
    updated: string[];
    failed: string[];
}

// Desired configuration for every smart meter in the fleet. Devices poll desired() and
// install whatever firmware it names, so a wrong answer here reflashes real hardware.
export class ConfigRegistry {
    private readonly store: QuorumStore<DeviceConfig>;

    constructor(store: QuorumStore<DeviceConfig>) {
        this.store = store;
    }

    async desired(deviceId: string): Promise<DeviceConfig> {
        return (await this.store.get(`cfg:${deviceId}`)) ?? FACTORY_CONFIG;
    }

    async rollout(deviceIds: string[], firmware: string): Promise<RolloutReport> {
        const report: RolloutReport = { updated: [], failed: [] };
        for (const id of deviceIds) {
            try {
                const current = await this.desired(id);
                await this.store.put(`cfg:${id}`, { ...current, firmware });
                report.updated.push(id);
            } catch (err) {
                if (!(err instanceof QuorumError)) throw err;
                report.failed.push(id);
            }
        }
        return report;
    }
}
