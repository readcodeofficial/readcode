import type { CarrierAdapter, Label, Parcel } from "./carrier.ts";
import { AppError, isRetryable, mergedContext, toLogRecord, wrap, type LogRecord } from "./errors.ts";

export interface Shipment {
    id: string;
    orderId: string;
    carrier: string;
    parcel: Parcel;
}

export class LabelService {
    private readonly carriers: Map<string, CarrierAdapter>;
    private readonly maxAttempts: number;

    constructor(carriers: CarrierAdapter[], maxAttempts = 3) {
        this.carriers = new Map(carriers.map((c) => [c.name, c]));
        this.maxAttempts = maxAttempts;
    }

    async buy(shipment: Shipment): Promise<Label> {
        const carrier = this.carriers.get(shipment.carrier);
        if (!carrier) throw new AppError(`no carrier named ${shipment.carrier}`, { code: "unknown_carrier", context: { shipmentId: shipment.id } });
        for (let attempt = 1; ; attempt++) {
            try {
                return await carrier.purchaseLabel(shipment.parcel);
            } catch (err) {
                if (attempt < this.maxAttempts && isRetryable(err)) continue;
                throw wrap(err, `label for shipment ${shipment.id}`, { shipmentId: shipment.id, orderId: shipment.orderId, attempts: attempt });
            }
        }
    }
}

export interface WaveFailure {
    shipmentId: string;
    code: string;
    carrier: string;
    log: LogRecord;
}

export interface WaveReport {
    labels: Label[];
    failures: WaveFailure[];
}

// Buys labels for a warehouse pick wave. Failed shipments go to the ops dashboard for manual handling.
export async function buyWave(service: LabelService, waveId: string, shipments: Shipment[]): Promise<WaveReport> {
    const report: WaveReport = { labels: [], failures: [] };
    for (const shipment of shipments) {
        try {
            report.labels.push(await service.buy(shipment));
        } catch (err) {
            const failure = wrap(err, `wave ${waveId}`, { waveId });
            report.failures.push({
                shipmentId: shipment.id,
                code: failure.code,
                carrier: String(mergedContext(failure).carrier ?? "unknown"),
                log: toLogRecord(failure),
            });
        }
    }
    return report;
}
