import type { Reading } from "./store.ts";

// What trucks (via the cellular gateway) send us, and what we send to partners: snake_case JSON.
// recorded_at is Unix time in seconds. Trucks on the old firmware still send an ISO-8601 string.
export interface WireReading {
    device_id: string;
    recorded_at: number | string;
    odometer_km: number;
    fuel_pct: number;
    location: { lat: number; lon: number } | null;
    fault_codes?: string[];
}

export class DecodeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DecodeError";
    }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown, field: string): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new DecodeError(`${field} must be a number`);
    return v;
};

function decodeTimestamp(v: unknown): Date {
    let at: Date;
    if (typeof v === "string") at = new Date(v);
    else at = new Date(finite(v, "recorded_at"));
    if (Number.isNaN(at.getTime())) throw new DecodeError("recorded_at is not a valid time");
    return at;
}

export function decodeReading(raw: unknown): Reading {
    if (!isObject(raw)) throw new DecodeError("reading must be an object");
    if (typeof raw.device_id !== "string" || raw.device_id === "") throw new DecodeError("device_id is required");

    const fuel = finite(raw.fuel_pct, "fuel_pct");
    if (fuel < 0 || fuel > 100) throw new DecodeError("fuel_pct must be between 0 and 100");

    let location: Reading["location"] = null;
    if (raw.location !== null && raw.location !== undefined) {
        if (!isObject(raw.location)) throw new DecodeError("location must be an object or null");
        location = { lat: finite(raw.location.lat, "location.lat"), lon: finite(raw.location.lon, "location.lon") };
    }

    const faults = raw.fault_codes ?? [];
    if (!Array.isArray(faults) || !faults.every((c) => typeof c === "string")) {
        throw new DecodeError("fault_codes must be a list of strings");
    }

    return {
        deviceId: raw.device_id,
        recordedAt: decodeTimestamp(raw.recorded_at),
        odometerKm: finite(raw.odometer_km, "odometer_km"),
        fuelPct: fuel,
        location,
        faultCodes: faults,
    };
}

export function encodeReading(r: Reading): WireReading {
    return {
        device_id: r.deviceId,
        recorded_at: Math.floor(r.recordedAt.getTime() / 1000),
        odometer_km: r.odometerKm,
        fuel_pct: r.fuelPct,
        location: r.location,
        fault_codes: r.faultCodes,
    };
}
