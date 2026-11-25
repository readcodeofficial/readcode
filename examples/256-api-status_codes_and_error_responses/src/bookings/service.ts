import { BookingError, ReservationClosedError, ReservationNotFoundError, RoomUnavailableError } from "./errors.ts";

export interface Reservation {
    id: string;
    roomId: string;
    guestName: string;
    checkIn: string; // YYYY-MM-DD
    checkOut: string;
    status: "confirmed" | "checked_in" | "cancelled";
}

export interface ReservationRepo {
    get(id: string): Promise<Reservation | null>;
    forRoom(roomId: string): Promise<Reservation[]>;
    save(r: Reservation): Promise<void>;
}

export interface Inventory {
    // Asks the channel manager to hold the room; may throw UpstreamTimeoutError.
    hold(roomId: string, checkIn: string, checkOut: string): Promise<void>;
}

const MAX_NIGHTS = 30;
const nights = (checkIn: string, checkOut: string) => (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000;

export class ReservationService {
    private readonly repo: ReservationRepo;
    private readonly inventory: Inventory;
    private readonly newId: () => string;

    constructor(repo: ReservationRepo, inventory: Inventory, newId: () => string) {
        this.repo = repo;
        this.inventory = inventory;
        this.newId = newId;
    }

    async book(input: Omit<Reservation, "id" | "status">): Promise<Reservation> {
        if (nights(input.checkIn, input.checkOut) > MAX_NIGHTS) {
            throw new BookingError("stay_too_long", `Stays are limited to ${MAX_NIGHTS} nights`);
        }
        const clash = (await this.repo.forRoom(input.roomId)).some(
            (r) => r.status !== "cancelled" && r.checkIn < input.checkOut && input.checkIn < r.checkOut,
        );
        if (clash) throw new RoomUnavailableError(input.roomId);

        await this.inventory.hold(input.roomId, input.checkIn, input.checkOut);
        const reservation: Reservation = { ...input, id: this.newId(), status: "confirmed" };
        await this.repo.save(reservation);
        return reservation;
    }

    async get(id: string): Promise<Reservation> {
        const r = await this.repo.get(id);
        if (!r) throw new ReservationNotFoundError(id);
        return r;
    }

    async cancel(id: string): Promise<Reservation> {
        const r = await this.get(id);
        if (r.status !== "confirmed") throw new ReservationClosedError(id, r.status);
        const cancelled = { ...r, status: "cancelled" as const };
        await this.repo.save(cancelled);
        return cancelled;
    }
}
