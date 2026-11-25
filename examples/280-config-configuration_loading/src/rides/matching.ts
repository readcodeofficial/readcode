import type { DispatchConfig } from "../config/defaults.ts";

export interface Driver {
    id: string;
    vehicleClass: string;
    distanceKm: number;
    etaMinutes: number;
}

// Nearest driver of the requested class within the search radius and ETA limit.
export function pickDriver(dispatch: DispatchConfig, drivers: Driver[], vehicleClass: string): Driver | null {
    if (!dispatch.vehicleClasses.includes(vehicleClass)) throw new Error(`${vehicleClass} rides are not offered here`);
    const eligible = drivers.filter(
        (d) => d.vehicleClass === vehicleClass && d.distanceKm <= dispatch.searchRadiusKm && d.etaMinutes <= dispatch.maxEtaMinutes,
    );
    eligible.sort((a, b) => a.etaMinutes - b.etaMinutes || a.distanceKm - b.distanceKm);
    return eligible[0] ?? null;
}
