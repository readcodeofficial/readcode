export interface PricingConfig {
    currency: string;
    baseFareCents: number;
    perKmCents: number;
    perMinuteCents: number;
    minimumFareCents: number;
    surgeCap: number; // highest surge multiplier we will charge
}

export interface DispatchConfig {
    searchRadiusKm: number;
    maxEtaMinutes: number;
    vehicleClasses: string[];
}

export interface RideConfig {
    city: string;
    pricing: PricingConfig;
    dispatch: DispatchConfig;
    features: { scheduledRides: boolean };
}

export const DEFAULTS: RideConfig = {
    city: "default",
    pricing: {
        currency: "EUR",
        baseFareCents: 250,
        perKmCents: 110,
        perMinuteCents: 25,
        minimumFareCents: 600,
        surgeCap: 2,
    },
    dispatch: {
        searchRadiusKm: 5,
        maxEtaMinutes: 12,
        vehicleClasses: ["standard", "xl"],
    },
    features: { scheduledRides: false },
};
