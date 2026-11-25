import type { PricingConfig } from "../config/defaults.ts";

export interface Trip {
    distanceKm: number;
    minutes: number;
    surge: number; // multiplier from the demand model
}

export interface Quote {
    currency: string;
    amountCents: number;
    surgeApplied: number;
}

export function quoteFare(pricing: PricingConfig, trip: Trip): Quote {
    const surge = Math.min(Math.max(trip.surge, 1), pricing.surgeCap);
    const metered = pricing.baseFareCents + pricing.perKmCents * trip.distanceKm + pricing.perMinuteCents * trip.minutes;
    return {
        currency: pricing.currency,
        amountCents: Math.max(pricing.minimumFareCents, Math.round(metered * surge)),
        surgeApplied: surge,
    };
}
