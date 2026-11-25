import type { SurgeService } from "./surge.ts";

export interface Trip {
    zoneId: string;
    distanceKm: number;
    durationMin: number;
}

export interface FareQuote {
    zoneId: string;
    baseCents: number;
    multiplier: number;
    totalCents: number;
}

const BOOKING_FEE_CENTS = 250;
const PER_KM_CENTS = 110;
const PER_MIN_CENTS = 30;
const MIN_FARE_CENTS = 700;

// The booking fee isn't surged; distance and time are.
export async function quoteFare(surge: Pick<SurgeService, "surgeFor">, trip: Trip): Promise<FareQuote> {
    if (!(trip.distanceKm >= 0) || !(trip.durationMin >= 0)) throw new Error("Trip distance and duration must be non-negative");
    const { multiplier } = await surge.surgeFor(trip.zoneId);
    const baseCents = Math.round(trip.distanceKm * PER_KM_CENTS + trip.durationMin * PER_MIN_CENTS);
    const totalCents = Math.max(MIN_FARE_CENTS, BOOKING_FEE_CENTS + Math.round(baseCents * multiplier));
    return { zoneId: trip.zoneId, baseCents, multiplier, totalCents };
}
