import { TtlCache } from "./ttlCache.ts";

export interface ZoneDemand {
    openRequests: number;
    availableDrivers: number;
}

// Live marketplace counters; slow and rate-limited, so results are cached.
export interface DemandFeed {
    current(zoneId: string): Promise<ZoneDemand>;
}

export const SURGE_TTL_MS = 30_000; // a computed multiplier is good for 30s
export const FALLBACK_TTL_MS = 5_000; // after a feed error, try again soon
const MAX_MULTIPLIER = 3;

export interface Surge {
    multiplier: number;
    source: "live" | "fallback";
}

export function multiplierFrom({ openRequests, availableDrivers }: ZoneDemand): number {
    const ratio = openRequests / Math.max(1, availableDrivers);
    if (ratio <= 1) return 1;
    return Math.min(MAX_MULTIPLIER, Math.round(ratio * 10) / 10);
}

export class SurgeService {
    private readonly feed: DemandFeed;
    private readonly cache: TtlCache<Surge>;

    constructor(feed: DemandFeed, now: () => number, maxZones = 500) {
        this.feed = feed;
        this.cache = new TtlCache<Surge>(maxZones, now);
    }

    async surgeFor(zoneId: string): Promise<Surge> {
        const cached = this.cache.get(zoneId);
        if (cached) return cached;
        try {
            const surge: Surge = { multiplier: multiplierFrom(await this.feed.current(zoneId)), source: "live" };
            this.cache.set(zoneId, surge, SURGE_TTL_MS);
            return surge;
        } catch {
            // Never block a ride on the feed: no surge until it recovers.
            const surge: Surge = { multiplier: 1, source: "fallback" };
            this.cache.set(zoneId, surge, FALLBACK_TTL_MS);
            return surge;
        }
    }
}
