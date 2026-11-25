import { distanceKm, type LatLng } from "./geo.ts";
import type { DriverRegistry, VehicleClass } from "./drivers.ts";

export interface EtaService {
    // Driving time in minutes, from the routing service.
    minutes(from: LatLng, to: LatLng): Promise<number>;
}

export interface Assignment {
    driverId: string;
    etaMinutes: number;
}

const MAX_PICKUP_MINUTES = 12;
const CANDIDATES = 3;

export class Dispatcher {
    private readonly drivers: DriverRegistry;
    private readonly eta: EtaService;
    private readonly radiusKm: number;

    constructor(drivers: DriverRegistry, eta: EtaService, radiusKm = 5) {
        this.drivers = drivers;
        this.eta = eta;
        this.radiusKm = radiusKm;
    }

    // Picks the closest available driver whose road ETA to the pickup is acceptable.
    async dispatch(rideId: string, pickup: LatLng, vehicle: VehicleClass): Promise<Assignment | null> {
        const shortlist = this.drivers
            .available(vehicle)
            .map((driver) => ({ driver, km: distanceKm(driver.location, pickup) }))
            .filter((c) => c.km <= this.radiusKm)
            .sort((a, b) => a.km - b.km)
            .slice(0, CANDIDATES);

        for (const { driver } of shortlist) {
            // Road time can be far off the straight-line distance (rivers, one-way streets).
            const etaMinutes = await this.eta.minutes(driver.location, pickup);
            if (etaMinutes > MAX_PICKUP_MINUTES) continue;
            this.drivers.markBusy(driver.id, rideId);
            return { driverId: driver.id, etaMinutes };
        }
        return null;
    }
}
