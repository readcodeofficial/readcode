import { AppError } from "./errors.ts";

export interface Parcel {
    weightGrams: number;
    fromPostcode: string;
    toPostcode: string;
}

export interface Label {
    carrier: string;
    trackingNumber: string;
}

export interface HttpResponse {
    status: number;
    headers: Record<string, string>;
    body: { trackingNumber?: string; error?: string; field?: string };
}

export interface Transport {
    post(path: string, body: unknown): Promise<HttpResponse>;
}

export class TransportError extends Error {
    readonly status: number;
    constructor(status: number, detail: string) {
        super(`HTTP ${status}: ${detail}`);
        this.name = "TransportError";
        this.status = status;
    }
}

// One carrier's label API. Failures are classified here, where the HTTP details are known.
export class CarrierAdapter {
    readonly name: string;
    private readonly transport: Transport;

    constructor(name: string, transport: Transport) {
        this.name = name;
        this.transport = transport;
    }

    async purchaseLabel(parcel: Parcel): Promise<Label> {
        const res = await this.transport.post("/v2/labels", { weight_g: parcel.weightGrams, from: parcel.fromPostcode, to: parcel.toPostcode });
        if (res.status === 201 && res.body.trackingNumber) return { carrier: this.name, trackingNumber: res.body.trackingNumber };

        const context = { carrier: this.name, httpStatus: res.status, carrierRequestId: res.headers["x-request-id"] };
        const cause = new TransportError(res.status, res.body.error ?? "no error body");
        if (res.status === 422) {
            throw new AppError(`${this.name} rejected the parcel`, { code: "parcel_rejected", context: { ...context, field: res.body.field }, cause });
        }
        if (res.status === 429 || res.status >= 500) {
            throw new AppError(`${this.name} is unavailable`, { code: "carrier_unavailable", retryable: true, context, cause });
        }
        throw new AppError(`${this.name} label request failed`, { code: "carrier_error", context, cause });
    }
}
