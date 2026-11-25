import type { Tracer } from "../tracing/tracer.ts";
import type { LabelBatcher } from "./labelBatcher.ts";
import type { Shipment } from "./carrier.ts";

export interface LabelRequest {
    headers: Record<string, string | undefined>;
    shipment: Shipment;
}

export interface LabelResponse {
    status: number;
    body: { trackingNumber?: string; error?: string };
}

// POST /shipments/:id/label. Continues the caller's trace when it sends a traceparent header.
export function labelHandler(tracer: Tracer, batcher: LabelBatcher) {
    return (req: LabelRequest): Promise<LabelResponse> =>
        tracer.withSpan(
            "POST /shipments/:id/label",
            async (span) => {
                span.attributes.shipmentId = req.shipment.id;
                if (req.shipment.weightGrams <= 0 || req.shipment.weightGrams > 30_000) {
                    return { status: 400, body: { error: "weight must be between 1 g and 30 kg" } };
                }
                try {
                    const label = await batcher.labelFor(req.shipment);
                    return { status: 201, body: { trackingNumber: label.trackingNumber } };
                } catch (err) {
                    return { status: 502, body: { error: (err as Error).message } };
                }
            },
            tracer.extract(req.headers.traceparent),
        );
}
