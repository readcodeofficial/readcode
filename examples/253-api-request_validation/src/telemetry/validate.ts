export type Sensor = "temp_c" | "humidity_pct" | "co2_ppm" | "soil_moisture_pct";

export interface Reading {
    sensor: Sensor;
    value: number;
    at: string; // ISO 8601, as sent by the device
}

export interface Batch {
    deviceId: string;
    readings: Reading[];
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

// Physically plausible ranges; anything outside is a broken probe, not a reading.
const RANGES: Record<Sensor, { min: number; max: number }> = {
    temp_c: { min: -40, max: 85 },
    humidity_pct: { min: 0, max: 100 },
    co2_ppm: { min: 0, max: 10_000 },
    soil_moisture_pct: { min: 0, max: 100 },
};

const DEVICE_ID = /^[a-z0-9-]{3,40}$/;
const MAX_READINGS = 500;
const MAX_CLOCK_SKEW_MS = 5 * 60_000; // device clocks drift a little
const MAX_AGE_MS = 7 * 24 * 3600_000; // devices buffer readings while offline

function parseReading(input: unknown, index: number, nowMs: number, errors: string[]): Reading | undefined {
    const where = `readings[${index}]`;
    if (typeof input !== "object" || input === null) {
        errors.push(`${where} must be an object`);
        return undefined;
    }
    const r = input as Record<string, unknown>;
    const before = errors.length;

    const sensor = r.sensor as Sensor;
    const range = Object.hasOwn(RANGES, sensor) ? RANGES[sensor] : undefined;
    if (!range) errors.push(`${where}.sensor must be one of ${Object.keys(RANGES).join(", ")}`);

    const value = r.value as number;
    if (!isFinite(value)) errors.push(`${where}.value must be a number`);
    else if (range && (value < range.min || value > range.max)) errors.push(`${where}.value ${value} is outside ${range.min}..${range.max}`);

    const at = typeof r.at === "string" ? Date.parse(r.at) : NaN;
    if (Number.isNaN(at)) errors.push(`${where}.at must be an ISO timestamp`);
    else if (at > nowMs + MAX_CLOCK_SKEW_MS) errors.push(`${where}.at is in the future`);
    else if (at < nowMs - MAX_AGE_MS) errors.push(`${where}.at is more than 7 days old`);

    return errors.length === before ? { sensor, value, at: new Date(at).toISOString() } : undefined;
}

export function parseBatch(body: unknown, nowMs: number): Parsed<Batch> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, errors: ["body must be a JSON object"] };
    const { deviceId, readings } = body as Record<string, unknown>;
    const errors: string[] = [];

    if (typeof deviceId !== "string" || !DEVICE_ID.test(deviceId)) errors.push("deviceId must be 3-40 lowercase letters, digits or dashes");
    if (!Array.isArray(readings) || readings.length === 0 || readings.length > MAX_READINGS) {
        errors.push(`readings must be an array of 1 to ${MAX_READINGS} items`);
        return { ok: false, errors };
    }
    const parsed = readings.map((r, i) => parseReading(r, i, nowMs, errors));
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: { deviceId: deviceId as string, readings: parsed as Reading[] } };
}
