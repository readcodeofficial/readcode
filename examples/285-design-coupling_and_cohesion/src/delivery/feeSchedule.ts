export interface FeeSchedule {
    deliveryCents: number;
    serviceFeeRate: number;
    minServiceFeeCents: number;
    freeDeliveryOverCents: number | null; // null: no free-delivery threshold in this zone
    smallOrderUnderCents: number;
    smallOrderFeeCents: number;
    courierShare: number; // fraction of the zone's delivery fee paid to the courier
}

// Fee schedule per delivery zone, as set by the city operations team.
const ZONES: Record<string, FeeSchedule> = {
    "lis-centro": {
        deliveryCents: 299,
        serviceFeeRate: 0.1,
        minServiceFeeCents: 99,
        freeDeliveryOverCents: 3000,
        smallOrderUnderCents: 1000,
        smallOrderFeeCents: 150,
        courierShare: 0.8,
    },
    "lis-oriente": {
        deliveryCents: 399,
        serviceFeeRate: 0.12,
        minServiceFeeCents: 129,
        freeDeliveryOverCents: null,
        smallOrderUnderCents: 1200,
        smallOrderFeeCents: 200,
        courierShare: 0.75,
    },
};

export class UnknownZoneError extends Error {
    constructor(zone: string) {
        super(`We don't deliver to zone ${zone}`);
        this.name = "UnknownZoneError";
    }
}

export function feesFor(zone: string): FeeSchedule {
    const fees = ZONES[zone];
    if (!fees) throw new UnknownZoneError(zone);
    return fees;
}
