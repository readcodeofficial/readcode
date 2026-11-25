export interface Reading {
    deviceId: string;
    recordedAt: Date;
    odometerKm: number;
    fuelPct: number;
    location: { lat: number; lon: number } | null;
    faultCodes: string[];
}

export class ReadingStore {
    private readonly byDevice = new Map<string, Reading[]>();

    add(r: Reading): void {
        const list = this.byDevice.get(r.deviceId) ?? [];
        list.push(r);
        list.sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
        this.byDevice.set(r.deviceId, list);
    }

    history(deviceId: string): Reading[] {
        return [...(this.byDevice.get(deviceId) ?? [])];
    }

    // Last known position of each truck, for the dispatcher map.
    latestPositions(): Map<string, { lat: number; lon: number; at: Date }> {
        const out = new Map<string, { lat: number; lon: number; at: Date }>();
        for (const [deviceId, list] of this.byDevice) {
            const last = [...list].reverse().find((r) => r.location !== null);
            if (last?.location) out.set(deviceId, { ...last.location, at: last.recordedAt });
        }
        return out;
    }
}
