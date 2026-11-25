import { VersionedCache } from "./versionedCache.ts";

export type SeatsLeft = Record<string, number>; // section -> seats left

export interface EventRow {
    eventId: string;
    version: number;
    seatsLeft: SeatsLeft;
}

export interface EventStore {
    load(eventId: string): Promise<EventRow | null>;
    // Atomically adds `delta` seats to a section and bumps the version; returns the new version.
    // Throws SoldOutError instead of going below zero.
    adjust(eventId: string, section: string, delta: number): Promise<number>;
}

export class SoldOutError extends Error {
    constructor(eventId: string, section: string) {
        super(`Not enough seats left in ${section} for ${eventId}`);
        this.name = "SoldOutError";
    }
}

export const AVAILABILITY_TTL_MS = 60_000;

// Seat counts for the event pages. Every page view reads availability, so it is cached.
export class SeatInventory {
    private readonly store: EventStore;
    private readonly cache: VersionedCache<SeatsLeft>;

    constructor(store: EventStore, now: () => number) {
        this.store = store;
        this.cache = new VersionedCache<SeatsLeft>(AVAILABILITY_TTL_MS, now);
    }

    async availability(eventId: string): Promise<SeatsLeft> {
        const cached = this.cache.get(eventId);
        if (cached) return cached.value;
        const row = await this.store.load(eventId);
        if (!row) throw new Error(`Unknown event ${eventId}`);
        this.cache.fill(eventId, row.seatsLeft, row.version);
        return row.seatsLeft;
    }

    async reserve(eventId: string, section: string, qty: number): Promise<void> {
        const version = await this.store.adjust(eventId, section, -qty);
        this.cache.invalidate(eventId, version);
    }

    // Seats come back when a hold expires or an order is refunded.
    async release(eventId: string, section: string, qty: number): Promise<void> {
        const version = await this.store.adjust(eventId, section, qty);
        this.cache.invalidate(eventId, version);
    }
}
