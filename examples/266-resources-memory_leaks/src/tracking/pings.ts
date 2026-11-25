import { isValidPosition } from "./geo.ts";
import type { LocationTracker } from "./tracker.ts";

const MAX_AGE_MS = 30_000;

export type PingResult = { accepted: true } | { accepted: false; reason: string };

// POST /driver/location from the driver app. Old or malformed pings are dropped, not forwarded.
export function handleDriverPing(tracker: LocationTracker, body: unknown, now: number): PingResult {
    const { driverId, position, at } = (body ?? {}) as Record<string, unknown>;
    if (typeof driverId !== "string" || driverId === "") return { accepted: false, reason: "driverId is required" };
    if (!isValidPosition(position)) return { accepted: false, reason: "position is invalid" };
    if (typeof at !== "number" || at > now + 5_000) return { accepted: false, reason: "timestamp is invalid" };
    if (now - at > MAX_AGE_MS) return { accepted: false, reason: "ping is stale" };
    tracker.publish({ driverId, position: { lat: position.lat, lng: position.lng }, at });
    return { accepted: true };
}
