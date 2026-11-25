import type { Reservation, ReservationRepo } from "./reservations.ts";

export interface ArrivalLine {
    reservationId: string;
    guestId: string;
    roomType: Reservation["roomType"];
    nights: number;
}

const addDays = (day: string, n: number) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

// The morning arrivals sheet printed for reception.
export async function arrivalsSheet(repo: ReservationRepo, hotelId: string, day: string): Promise<ArrivalLine[]> {
    const arriving = await repo.arrivals(hotelId, day);
    return arriving.map((r) => ({ reservationId: r.id, guestId: r.guestId, roomType: r.roomType, nights: r.nights }));
}

// Rooms of each type occupied on the night of `day`. Anyone who checked in within the
// longest allowed stay before it and hasn't left yet is still in the building.
export async function roomsOccupied(
    repo: ReservationRepo,
    hotelId: string,
    day: string,
    maxStayNights = 30,
): Promise<Record<Reservation["roomType"], number>> {
    const counts = { standard: 0, deluxe: 0, suite: 0 };
    const candidates = await repo.arrivals(hotelId, addDays(day, -(maxStayNights - 1)), day);
    for (const r of candidates) {
        if (addDays(r.checkIn, r.nights) > day) counts[r.roomType]++;
    }
    return counts;
}
