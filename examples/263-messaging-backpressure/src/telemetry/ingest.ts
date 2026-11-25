import type { BoundedChannel } from "./channel.ts";

export interface Reading {
    deviceId: string;
    metric: string;
    value: number;
    at: number; // epoch millis, as reported by the device
}

export interface IngestStats {
    accepted: number;
    rejected: number;
}

const METRIC = /^[a-z][a-z0-9_.]{0,63}$/;

// Devices send one frame per reading: "<metric> <value> <epochMillis>".
export function parseFrame(deviceId: string, frame: string): Reading | null {
    const parts = frame.trim().split(/\s+/);
    if (parts.length !== 3) return null;
    const [metric, rawValue, rawAt] = parts;
    const value = Number(rawValue);
    const at = Number(rawAt);
    if (!METRIC.test(metric) || !Number.isFinite(value) || !Number.isInteger(at) || at <= 0) return null;
    return { deviceId, metric, value, at };
}

// Reads one device connection until it closes and forwards every valid reading to the writer.
// A device that sends faster than storage can absorb is slowed down to storage's pace.
export async function ingestDevice(
    deviceId: string,
    frames: AsyncIterable<string>,
    channel: BoundedChannel<Reading>,
    stats: IngestStats,
): Promise<void> {
    const handedOver: Promise<void>[] = [];
    for await (const frame of frames) {
        const reading = parseFrame(deviceId, frame);
        if (!reading) {
            stats.rejected++;
            continue;
        }
        handedOver.push(channel.send(reading));
        stats.accepted++;
    }
    await Promise.all(handedOver);
}
