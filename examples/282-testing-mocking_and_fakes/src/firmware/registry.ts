export interface Device {
    id: string;
    cohort: string; // e.g. "thermostat-eu-beta"
    online: boolean;
    firmware: string;
    status: "idle" | "updating" | "quarantined";
    targetVersion: string | null;
    failures: number; // consecutive failed update attempts
    lastError: string | null;
    lastOfferedAt: string | null;
}

// The device registry service. In production this is a remote store: reads return
// snapshots, and nothing changes until save() is called.
export interface DeviceRegistry {
    get(id: string): Promise<Device | null>;
    listByCohort(cohort: string): Promise<Device[]>;
    save(device: Device): Promise<void>;
}
