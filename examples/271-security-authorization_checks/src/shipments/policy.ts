import type { Actor, Shipment } from "./model.ts";

export type Action = "view" | "update_status" | "cancel" | "reassign_carrier";

// Who may do what to a shipment.
//  - the shipper's people and the assigned carrier's people can see it
//  - the carrier's dispatchers and admins report pickup / transit / delivery
//  - the shipper's dispatchers and admins can cancel it or move it to another carrier
export function can(actor: Actor, action: Action, shipment: Shipment): boolean {
    const isShipper = actor.orgId === shipment.shipperOrgId;
    const isCarrier = shipment.carrierOrgId !== null && actor.orgId === shipment.carrierOrgId;

    switch (action) {
        case "view":
            return isShipper || isCarrier;
        case "update_status":
            return isCarrier && actor.role !== "viewer";
        case "cancel":
        case "reassign_carrier":
            return actor.role === "admin" || (isShipper && actor.role === "dispatcher");
    }
}
