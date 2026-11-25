export type ShipmentStatus = "label_created" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "unknown";

export interface TrackingInfo {
    trackingNumber: string;
    status: ShipmentStatus;
    lastEventAt: string | null;
    etaDate: string | null;
}

export class CarrierUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CarrierUnavailableError";
    }
}
