import type { EventEmitter } from "node:events";
import { etaMinutes, type LatLng } from "./geo.ts";

export interface DriverPing {
    driverId: string;
    position: LatLng;
    at: number; // epoch millis
}

export interface RiderUpdate {
    driverId: string;
    position: LatLng;
    etaMinutes: number;
    at: number;
}

const topic = (driverId: string) => `driver:${driverId}`;

const toUpdate = (ping: DriverPing, pickup: LatLng): RiderUpdate => ({
    driverId: ping.driverId,
    position: ping.position,
    etaMinutes: etaMinutes(ping.position, pickup),
    at: ping.at,
});

// Fans driver location pings out to the riders waiting for that driver.
// One tracker per process; it lives as long as the server does.
export class LocationTracker {
    private readonly bus: EventEmitter;
    private readonly lastPing = new Map<string, DriverPing>();
    private readonly watchers = new Map<string, number>();

    constructor(bus: EventEmitter) {
        this.bus = bus;
    }

    publish(ping: DriverPing): void {
        this.lastPing.set(ping.driverId, ping);
        this.bus.emit(topic(ping.driverId), ping);
    }

    // Calls onUpdate with every new position of the driver, starting with the last known one.
    // Returns a function that stops the updates.
    watch(driverId: string, pickup: LatLng, onUpdate: (update: RiderUpdate) => void): () => void {
        const listener = (ping: DriverPing) => onUpdate(toUpdate(ping, pickup));
        this.bus.on(topic(driverId), listener);
        this.watchers.set(driverId, (this.watchers.get(driverId) ?? 0) + 1);

        const last = this.lastPing.get(driverId);
        if (last) onUpdate(toUpdate(last, pickup));

        let active = true;
        return () => {
            if (!active) return;
            active = false;
            this.bus.off(topic(driverId), onUpdate);
            const remaining = (this.watchers.get(driverId) ?? 1) - 1;
            if (remaining > 0) this.watchers.set(driverId, remaining);
            else this.watchers.delete(driverId);
        };
    }

    // Shown on the ops dashboard.
    watcherCount(driverId: string): number {
        return this.watchers.get(driverId) ?? 0;
    }

    driverWentOffline(driverId: string): void {
        this.lastPing.delete(driverId);
    }
}
