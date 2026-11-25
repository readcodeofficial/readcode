import type { LatLng } from "./geo.ts";
import type { LocationTracker } from "./tracker.ts";

export interface RiderSocket {
    send(message: string): void;
}

// One rider's live "where is my driver" connection for a single trip.
// The driver can change (reassignment after a cancel) while the connection stays open.
export class RiderSession {
    private readonly tracker: LocationTracker;
    private readonly socket: RiderSocket;
    private readonly pickup: LatLng;
    private stopWatching: (() => void) | null = null;
    driverId: string | null = null;

    constructor(tracker: LocationTracker, socket: RiderSocket, pickup: LatLng) {
        this.tracker = tracker;
        this.socket = socket;
        this.pickup = pickup;
    }

    assignDriver(driverId: string): void {
        this.stopWatching?.();
        this.driverId = driverId;
        this.socket.send(JSON.stringify({ type: "driver_assigned", driverId }));
        this.stopWatching = this.tracker.watch(driverId, this.pickup, (update) => {
            this.socket.send(JSON.stringify({ type: "driver_location", ...update }));
        });
    }

    // Trip finished or the rider closed the app.
    close(): void {
        this.stopWatching?.();
        this.stopWatching = null;
        this.driverId = null;
    }
}
