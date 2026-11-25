import { ConflictError, NotFoundError, ValidationError } from "./errors.js";

const SEAT = /^[A-Z][0-9]{1,2}$/;

export function createBookingService(events) {
  const holds = new Map();
  return {
    holdSeat(eventId, seat, customer) {
      const event = events.get(eventId);
      if (!event) throw new NotFoundError(`no event ${eventId}`);
      if (typeof seat !== "string" || !SEAT.test(seat)) {
        throw new ValidationError("seat must look like A1 or C12", { field: "seat" });
      }
      if (typeof customer !== "string" || customer === "") {
        throw new ValidationError("customer is required", { field: "customer" });
      }
      if (!event.seats.includes(seat)) throw new ValidationError(`no seat ${seat} in this venue`, { field: "seat" });
      const key = `${eventId}/${seat}`;
      const holder = holds.get(key);
      if (holder && holder !== customer) throw new ConflictError(`seat ${seat} is already held`, { seat });
      holds.set(key, customer);
      return { eventId, seat, customer };
    },
    heldSeats(eventId) {
      return [...holds.keys()].filter((k) => k.startsWith(`${eventId}/`)).map((k) => k.split("/")[1]).sort();
    },
  };
}
