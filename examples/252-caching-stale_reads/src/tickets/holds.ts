import { SoldOutError, type SeatInventory } from "./inventory.ts";

export type HoldResult =
    | { ok: true; section: string; qty: number }
    | { ok: false; reason: "sold_out" | "too_many" };

const MAX_PER_ORDER = 8;

// Called when a fan clicks "Buy". The cached availability check turns most requests for a
// sold-out section away without touching the database; the reservation itself is atomic.
export async function holdSeats(inventory: SeatInventory, eventId: string, section: string, qty: number): Promise<HoldResult> {
    if (!Number.isInteger(qty) || qty < 1) throw new Error("qty must be a positive integer");
    if (qty > MAX_PER_ORDER) return { ok: false, reason: "too_many" };

    const left = (await inventory.availability(eventId))[section];
    if (left === undefined) throw new Error(`Unknown section ${section}`);
    if (left < qty) return { ok: false, reason: "sold_out" };

    try {
        await inventory.reserve(eventId, section, qty);
    } catch (err) {
        if (err instanceof SoldOutError) return { ok: false, reason: "sold_out" };
        throw err;
    }
    return { ok: true, section, qty };
}
