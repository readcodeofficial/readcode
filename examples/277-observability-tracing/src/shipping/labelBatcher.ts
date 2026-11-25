import type { Span, Tracer } from "../tracing/tracer.ts";
import type { CarrierApi, Label, Shipment } from "./carrier.ts";

interface Pending {
    shipment: Shipment;
    resolve: (label: Label) => void;
    reject: (err: unknown) => void;
}

// Collects label requests made in the same tick and sends them to the carrier as one call.
export class LabelBatcher {
    private readonly carrier: CarrierApi;
    private readonly tracer: Tracer;
    private readonly maxBatch: number;
    private pending: Pending[] = [];
    private scheduled = false;

    constructor(carrier: CarrierApi, tracer: Tracer, maxBatch = 10) {
        this.carrier = carrier;
        this.tracer = tracer;
        this.maxBatch = maxBatch;
    }

    labelFor(shipment: Shipment): Promise<Label> {
        return new Promise<Label>((resolve, reject) => {
            this.pending.push({ shipment, resolve, reject });
            if (this.pending.length >= this.maxBatch) {
                this.flush();
            } else if (!this.scheduled) {
                this.scheduled = true;
                setImmediate(() => this.flush());
            }
        });
    }

    private flush(): void {
        this.scheduled = false;
        const batch = this.pending;
        this.pending = [];
        if (batch.length > 0) void this.send(batch);
    }

    private async send(batch: Pending[]): Promise<void> {
        // One span per waiting request, so every request's trace shows the carrier call it waited on.
        const spans: Span[] = batch.map((p) => {
            const span = this.tracer.startSpan("carrier.createLabels");
            span.attributes.shipmentId = p.shipment.id;
            span.attributes.batchSize = batch.length;
            return span;
        });
        try {
            const labels = await this.carrier.createLabels(batch.map((p) => p.shipment));
            const byShipment = new Map(labels.map((l) => [l.shipmentId, l]));
            batch.forEach((p, i) => {
                const label = byShipment.get(p.shipment.id);
                if (!label) {
                    const err = new Error(`carrier returned no label for ${p.shipment.id}`);
                    this.tracer.end(spans[i], err);
                    p.reject(err);
                    return;
                }
                spans[i].attributes.trackingNumber = label.trackingNumber;
                this.tracer.end(spans[i]);
                p.resolve(label);
            });
        } catch (err) {
            batch.forEach((p, i) => {
                this.tracer.end(spans[i], err);
                p.reject(err);
            });
        }
    }
}
