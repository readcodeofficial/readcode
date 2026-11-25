// Roles are per organization: an "admin" administers their own company's account.
export type Role = "admin" | "dispatcher" | "viewer";

export interface Actor {
    userId: string;
    orgId: string;
    role: Role;
}

export type ShipmentStatus = "booked" | "picked_up" | "in_transit" | "delivered" | "cancelled";

export interface Shipment {
    id: string;
    shipperOrgId: string; // the company that booked and pays for the shipment
    carrierOrgId: string | null; // the trucking company currently assigned
    status: ShipmentStatus;
    reference: string;
    history: { status: ShipmentStatus; by: string }[];
}

export interface ShipmentRepo {
    get(id: string): Promise<Shipment | null>;
    save(shipment: Shipment): Promise<void>;
}

export class NotFoundError extends Error {
    constructor(id: string) {
        super(`shipment ${id} not found`);
        this.name = "NotFoundError";
    }
}

export class ForbiddenError extends Error {
    constructor(action: string) {
        super(`not allowed to ${action} this shipment`);
        this.name = "ForbiddenError";
    }
}
