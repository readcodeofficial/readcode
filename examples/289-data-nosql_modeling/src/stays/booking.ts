import { randomUUID } from "node:crypto";
import type { Reservation, ReservationRepo } from "./reservations.ts";
import { roomsOccupied } from "./frontDesk.ts";

export type Inventory = Record<Reservation["roomType"], number>;

export class SoldOutError extends Error {
    constructor(roomType: string, night: string) {
        super(`No ${roomType} rooms left on ${night}`);
        this.name = "SoldOutError";
    }
}

const nightsOf = (checkIn: string, nights: number) =>
    Array.from({ length: nights }, (_, i) => {
        const d = new Date(`${checkIn}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
    });

// Books a room if every night of the stay still has one of that type free.
export async function bookRoom(
    repo: ReservationRepo,
    inventory: Inventory,
    request: Omit<Reservation, "id">,
    newId: () => string = randomUUID,
): Promise<Reservation> {
    for (const night of nightsOf(request.checkIn, request.nights)) {
        const occupied = await roomsOccupied(repo, request.hotelId, night);
        if (occupied[request.roomType] >= inventory[request.roomType]) throw new SoldOutError(request.roomType, night);
    }
    const reservation = { ...request, id: newId() };
    await repo.save(reservation);
    return reservation;
}
