import type { Logger } from "../log/logger.ts";
import { distanceKm, type DriverPool, type Point } from "./drivers.ts";

export interface RideRequest {
    requestId: string; // from the X-Request-Id header
    riderId: string;
    rideId: string;
    pickup: Point;
}

export type DispatchResult = { status: "assigned"; driverId: string; etaMinutes: number } | { status: "no_driver" };

const SEARCH_RADIUS_KM = 5;
const AVG_SPEED_KMH = 24;

// POST /rides: finds the closest available driver and reserves them for the ride.
export async function requestRide(root: Logger, pool: DriverPool, req: RideRequest): Promise<DispatchResult> {
    const log = root.child({ requestId: req.requestId, rideId: req.rideId, riderId: req.riderId });
    log.info("ride requested", { pickup: req.pickup });

    try {
        const candidates = (await pool.nearby(req.pickup, SEARCH_RADIUS_KM))
            .filter((d) => d.available)
            .map((d) => ({ driver: d, km: distanceKm(req.pickup, d.location) }))
            .sort((a, b) => a.km - b.km);
        log.debug("candidates found", { count: candidates.length });

        for (const { driver, km } of candidates) {
            if (!(await pool.reserve(driver.id, req.rideId))) {
                log.debug("driver taken by another ride", { driverId: driver.id });
                continue;
            }
            const etaMinutes = Math.max(1, Math.round((km / AVG_SPEED_KMH) * 60));
            log.info("driver assigned", { driverId: driver.id, etaMinutes });
            return { status: "assigned", driverId: driver.id, etaMinutes };
        }

        log.warn("no driver available", { radiusKm: SEARCH_RADIUS_KM, candidates: candidates.length });
        return { status: "no_driver" };
    } catch (err) {
        log.error("dispatch failed", { err });
        throw err;
    }
}
