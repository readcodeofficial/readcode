import { ForbiddenError, NotFoundError, type Actor, type Shipment, type ShipmentRepo, type ShipmentStatus } from "./model.ts";
import { can, type Action } from "./policy.ts";

const NEXT: Record<ShipmentStatus, ShipmentStatus[]> = {
    booked: ["picked_up"],
    picked_up: ["in_transit"],
    in_transit: ["delivered"],
    delivered: [],
    cancelled: [],
};

export class ShipmentService {
    private readonly repo: ShipmentRepo;

    constructor(repo: ShipmentRepo) {
        this.repo = repo;
    }

    // Loads a shipment and checks the actor may act on it. Anyone who can't even see it gets
    // "not found", so shipment ids from other companies can't be probed.
    private async load(actor: Actor, id: string, action: Action): Promise<Shipment> {
        const shipment = await this.repo.get(id);
        if (!shipment || !can(actor, "view", shipment)) throw new NotFoundError(id);
        if (action !== "view" && !can(actor, action, shipment)) throw new ForbiddenError(action.replace("_", " "));
        return shipment;
    }

    get(actor: Actor, id: string): Promise<Shipment> {
        return this.load(actor, id, "view");
    }

    async updateStatus(actor: Actor, id: string, status: ShipmentStatus): Promise<Shipment> {
        const shipment = await this.load(actor, id, "update_status");
        if (!NEXT[shipment.status].includes(status)) throw new Error(`cannot go from ${shipment.status} to ${status}`);
        return this.record(shipment, status, actor);
    }

    async cancel(actor: Actor, id: string): Promise<Shipment> {
        const shipment = await this.load(actor, id, "cancel");
        if (shipment.status !== "booked") throw new Error(`cannot cancel a shipment that is ${shipment.status}`);
        return this.record(shipment, "cancelled", actor);
    }

    async reassignCarrier(actor: Actor, id: string, carrierOrgId: string): Promise<Shipment> {
        const shipment = await this.load(actor, id, "reassign_carrier");
        if (shipment.status !== "booked") throw new Error("only a shipment not yet picked up can change carrier");
        const updated = { ...shipment, carrierOrgId };
        await this.repo.save(updated);
        return updated;
    }

    private async record(shipment: Shipment, status: ShipmentStatus, actor: Actor): Promise<Shipment> {
        const updated = { ...shipment, status, history: [...shipment.history, { status, by: actor.userId }] };
        await this.repo.save(updated);
        return updated;
    }
}
