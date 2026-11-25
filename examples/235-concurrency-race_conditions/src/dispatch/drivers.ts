import type { LatLng } from "./geo.ts";

export type VehicleClass = "standard" | "xl" | "comfort";

export interface Driver {
    id: string;
    vehicle: VehicleClass;
    location: LatLng;
    rideId: string | null; // the ride the driver is currently on, if any
}

// In-process view of the drivers currently online in one city.
export class DriverRegistry {
    private readonly drivers = new Map<string, Driver>();

    goOnline(id: string, vehicle: VehicleClass, location: LatLng): void {
        this.drivers.set(id, { id, vehicle, location, rideId: null });
    }

    get(id: string): Driver | undefined {
        return this.drivers.get(id);
    }

    available(vehicle: VehicleClass): Driver[] {
        return [...this.drivers.values()].filter((d) => d.rideId === null && d.vehicle === vehicle);
    }

    isAvailable(id: string): boolean {
        return this.drivers.get(id)?.rideId === null;
    }

    markBusy(id: string, rideId: string): void {
        const driver = this.drivers.get(id);
        if (!driver) throw new Error(`Driver ${id} is offline`);
        driver.rideId = rideId;
    }

    // Frees the driver at the drop-off point. Ignored if the driver has moved on to another ride.
    release(id: string, rideId: string, at: LatLng): void {
        const driver = this.drivers.get(id);
        if (!driver || driver.rideId !== rideId) return;
        driver.rideId = null;
        driver.location = at;
    }
}
