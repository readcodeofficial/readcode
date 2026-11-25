import type { StoredReading } from "./ingest.ts";
import type { Sensor } from "./validate.ts";

export interface HourlyAverage {
    hour: string; // e.g. 2026-11-19T08:00Z
    sensor: Sensor;
    average: number;
    count: number;
}

// Feeds the greenhouse dashboard and the ventilation controller.
export function hourlyAverages(readings: StoredReading[], deviceId: string): HourlyAverage[] {
    const buckets = new Map<string, { hour: string; sensor: Sensor; sum: number; count: number }>();
    for (const r of readings) {
        if (r.deviceId !== deviceId) continue;
        const hour = r.at.slice(0, 13) + ":00Z";
        const key = `${hour}|${r.sensor}`;
        const bucket = buckets.get(key) ?? { hour, sensor: r.sensor, sum: 0, count: 0 };
        bucket.sum += r.value;
        bucket.count += 1;
        buckets.set(key, bucket);
    }
    return [...buckets.values()]
        .sort((a, b) => a.hour.localeCompare(b.hour) || a.sensor.localeCompare(b.sensor))
        .map(({ hour, sensor, sum, count }) => ({ hour, sensor, average: Math.round((sum / count) * 10) / 10, count }));
}
