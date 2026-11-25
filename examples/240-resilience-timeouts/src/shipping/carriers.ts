export interface Shipment {
    fromZip: string;
    toZip: string;
    weightGrams: number;
    service: "ground" | "express";
}

export interface Quote {
    carrier: string;
    priceCents: number;
    transitDays: number;
}

export interface Carrier {
    name: string;
    quote(shipment: Shipment, signal: AbortSignal): Promise<Quote>;
}

// JSON-over-HTTP carriers. The transport rejects with signal.reason if the signal is aborted.
export type Transport = (path: string, body: unknown, signal: AbortSignal) => Promise<unknown>;

export class RestCarrier implements Carrier {
    readonly name: string;
    private readonly transport: Transport;

    constructor(name: string, transport: Transport) {
        this.name = name;
        this.transport = transport;
    }

    async quote(s: Shipment, signal: AbortSignal): Promise<Quote> {
        const res = (await this.transport("/v2/rates", { from: s.fromZip, to: s.toZip, grams: s.weightGrams, level: s.service }, signal)) as {
            rate: { amount: string; transit_days: number };
        };
        return { carrier: this.name, priceCents: Math.round(Number(res.rate.amount) * 100), transitDays: res.rate.transit_days };
    }
}

// Regional carrier's vendor SDK: callback-based, with no way to cancel a call in flight.
export interface SoapRateClient {
    getRate(req: { Origin: string; Dest: string; Pounds: number; Express: boolean }, cb: (err: Error | null, res?: { TotalCharge: number; Days: number }) => void): void;
}

export class SoapCarrier implements Carrier {
    readonly name: string;
    private readonly client: SoapRateClient;

    constructor(name: string, client: SoapRateClient) {
        this.name = name;
        this.client = client;
    }

    quote(s: Shipment): Promise<Quote> {
        const req = { Origin: s.fromZip, Dest: s.toZip, Pounds: Math.ceil(s.weightGrams / 453.6), Express: s.service === "express" };
        return new Promise((resolve, reject) => {
            this.client.getRate(req, (err, res) => {
                if (err || !res) reject(err ?? new Error(`${this.name}: empty rate response`));
                else resolve({ carrier: this.name, priceCents: Math.round(res.TotalCharge * 100), transitDays: res.Days });
            });
        });
    }
}
