import { DecodeError, decodeReading, encodeReading } from "./wire.ts";
import type { Reading, ReadingStore } from "./store.ts";

export interface IngestResult {
    accepted: number;
    rejected: { index: number; reason: string }[];
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // older data is useless for live dispatch
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

// POST /telemetry: a JSON array of readings from the gateway. Bad readings are reported, not fatal.
export function ingestBatch(rawBody: string, store: ReadingStore, now: Date): IngestResult {
    let items: unknown;
    try {
        items = JSON.parse(rawBody);
    } catch {
        throw new DecodeError("body is not valid JSON");
    }
    if (!Array.isArray(items)) throw new DecodeError("body must be a JSON array");

    const result: IngestResult = { accepted: 0, rejected: [] };
    items.forEach((item, index) => {
        let reading: Reading;
        try {
            reading = decodeReading(item);
        } catch (err) {
            if (!(err instanceof DecodeError)) throw err;
            result.rejected.push({ index, reason: err.message });
            return;
        }
        const age = now.getTime() - reading.recordedAt.getTime();
        if (age > MAX_AGE_MS) return void result.rejected.push({ index, reason: "stale" });
        if (age < -MAX_CLOCK_SKEW_MS) return void result.rejected.push({ index, reason: "from the future" });
        store.add(reading);
        result.accepted++;
    });
    return result;
}

// GET /partners/fuel-report: readings since a point in time, in the shared wire format.
export function exportSince(store: ReadingStore, deviceIds: string[], since: Date): string {
    const readings = deviceIds.flatMap((id) => store.history(id)).filter((r) => r.recordedAt >= since);
    return JSON.stringify(readings.map(encodeReading));
}
