import { CarrierUnavailableError, type ShipmentStatus, type TrackingInfo } from "./types.ts";

export type HttpGet = (url: string) => Promise<{ status: number; body: unknown }>;

interface SwiftShipEvent {
    code: string;
    occurred_at: string;
}

interface SwiftShipTracking {
    tracking_no: string;
    events: SwiftShipEvent[]; // oldest first
    estimated_delivery?: string | null;
}

const STATUS_BY_CODE: Record<string, ShipmentStatus> = {
    LC: "label_created",
    PU: "in_transit",
    IT: "in_transit",
    AR: "in_transit",
    OFD: "out_for_delivery",
    DL: "delivered",
    EX: "exception",
    RTS: "exception",
};

export function mapStatus(code: string | undefined): ShipmentStatus {
    if (code === undefined) return "label_created";
    return STATUS_BY_CODE[code] ?? "delivered";
}

export class SwiftShipAdapter {
    private readonly baseUrl: string;
    private readonly get: HttpGet;

    constructor(baseUrl: string, get: HttpGet) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.get = get;
    }

    async track(trackingNumber: string): Promise<TrackingInfo | null> {
        const res = await this.get(`${this.baseUrl}/v2/tracking/${encodeURIComponent(trackingNumber)}`);
        if (res.status === 404) return null;
        if (res.status === 429 || res.status >= 500) {
            throw new CarrierUnavailableError(`SwiftShip returned ${res.status}`);
        }
        if (res.status !== 200) throw new Error(`Unexpected SwiftShip response ${res.status}`);

        const body = res.body as SwiftShipTracking;
        const latest = body.events.at(-1);
        return {
            trackingNumber: body.tracking_no,
            status: mapStatus(latest?.code),
            lastEventAt: latest?.occurred_at ?? null,
            etaDate: body.estimated_delivery ?? null,
        };
    }
}
