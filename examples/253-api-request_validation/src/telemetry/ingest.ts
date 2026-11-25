import { parseBatch, type Reading } from "./validate.ts";

export interface StoredReading extends Reading {
    deviceId: string;
}

export interface ReadingStore {
    append(rows: StoredReading[]): Promise<void>;
}

export interface Response {
    status: number;
    body: unknown;
}

// POST /v1/telemetry. A batch is all or nothing: if any reading is invalid, nothing is stored
// and the device gets every problem back so the firmware log shows what to fix.
export async function ingest(body: unknown, store: ReadingStore, now: () => Date): Promise<Response> {
    const parsed = parseBatch(body, now().getTime());
    if (!parsed.ok) return { status: 400, body: { error: "invalid_batch", details: parsed.errors } };
    const { deviceId, readings } = parsed.value;
    await store.append(readings.map((r) => ({ ...r, deviceId })));
    return { status: 202, body: { accepted: readings.length } };
}
