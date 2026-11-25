import type { Item, Table } from "./table.ts";

export interface Reservation {
    id: string;
    hotelId: string;
    guestId: string;
    roomType: "standard" | "deluxe" | "suite";
    checkIn: string; // YYYY-MM-DD
    nights: number;
}

// Single-table layout. Each reservation is written twice:
//   HOTEL#<hotelId> / STAY#<checkIn>#...  -> the front desk's view, ordered by arrival date
//   GUEST#<guestId> / RES#<id>            -> "my trips" for a guest, and the way back to the hotel item
const hotelKey = (r: Reservation) => ({ pk: `HOTEL#${r.hotelId}`, sk: `STAY#${r.checkIn}#${r.guestId}` });
const guestKey = (guestId: string, id: string) => ({ pk: `GUEST#${guestId}`, sk: `RES#${id}` });

const toReservation = (item: Item): Reservation => item.reservation as Reservation;

export class ReservationRepo {
    private readonly table: Table;

    constructor(table: Table) {
        this.table = table;
    }

    async save(r: Reservation): Promise<void> {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.checkIn)) throw new Error(`checkIn must be YYYY-MM-DD, got ${r.checkIn}`);
        if (!Number.isInteger(r.nights) || r.nights < 1) throw new Error("nights must be a positive integer");
        await this.table.put({ ...hotelKey(r), reservation: r });
        await this.table.put({ ...guestKey(r.guestId, r.id), reservation: r });
    }

    async get(guestId: string, id: string): Promise<Reservation | null> {
        const { pk, sk } = guestKey(guestId, id);
        const item = await this.table.get(pk, sk);
        return item ? toReservation(item) : null;
    }

    async cancel(guestId: string, id: string): Promise<boolean> {
        const r = await this.get(guestId, id);
        if (!r) return false;
        const h = hotelKey(r);
        await this.table.delete(h.pk, h.sk);
        const g = guestKey(guestId, id);
        await this.table.delete(g.pk, g.sk);
        return true;
    }

    // Reservations arriving on one day, or in an inclusive range of days.
    async arrivals(hotelId: string, from: string, to: string = from): Promise<Reservation[]> {
        const items = await this.table.query(`HOTEL#${hotelId}`, { between: [`STAY#${from}`, `STAY#${to}#\uffff`] });
        return items.map(toReservation);
    }

    async forGuest(guestId: string): Promise<Reservation[]> {
        const items = await this.table.query(`GUEST#${guestId}`, { beginsWith: "RES#" });
        return items.map(toReservation);
    }
}
