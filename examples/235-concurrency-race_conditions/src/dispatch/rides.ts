import type { Dispatcher } from "./dispatcher.ts";
import type { DriverRegistry, VehicleClass } from "./drivers.ts";
import type { LatLng } from "./geo.ts";

export interface Ride {
    id: string;
    riderId: string;
    pickup: LatLng;
    vehicle: VehicleClass;
    status: "assigned" | "no_driver" | "completed";
    driverId?: string;
    etaMinutes?: number;
}

export class RideService {
    private readonly dispatcher: Dispatcher;
    private readonly drivers: DriverRegistry;
    private readonly rides = new Map<string, Ride>();
    private seq = 0;

    constructor(dispatcher: Dispatcher, drivers: DriverRegistry) {
        this.dispatcher = dispatcher;
        this.drivers = drivers;
    }

    async request(riderId: string, pickup: LatLng, vehicle: VehicleClass = "standard"): Promise<Ride> {
        const id = `ride-${++this.seq}`;
        const assignment = await this.dispatcher.dispatch(id, pickup, vehicle);
        const ride: Ride = assignment
            ? { id, riderId, pickup, vehicle, status: "assigned", ...assignment }
            : { id, riderId, pickup, vehicle, status: "no_driver" };
        this.rides.set(id, ride);
        return ride;
    }

    complete(rideId: string, dropoff: LatLng): Ride {
        const ride = this.rides.get(rideId);
        if (!ride || ride.status !== "assigned" || !ride.driverId) throw new Error(`Ride ${rideId} is not in progress`);
        this.drivers.release(ride.driverId, rideId, dropoff);
        ride.status = "completed";
        return ride;
    }

    get(rideId: string): Ride | undefined {
        return this.rides.get(rideId);
    }
}
