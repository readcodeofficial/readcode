import { ForbiddenError, NotFoundError, type Actor, type ShipmentStatus } from "./model.ts";
import type { ShipmentService } from "./service.ts";

export interface Response {
    status: number;
    body: unknown;
}

// POST /shipments/:id/{status,cancel,carrier}. The actor comes from the verified session, never the body.
export function shipmentRoutes(service: ShipmentService) {
    async function run(work: () => Promise<unknown>): Promise<Response> {
        try {
            return { status: 200, body: await work() };
        } catch (err) {
            if (err instanceof NotFoundError) return { status: 404, body: { error: err.message } };
            if (err instanceof ForbiddenError) return { status: 403, body: { error: err.message } };
            return { status: 409, body: { error: (err as Error).message } };
        }
    }

    return {
        status: (actor: Actor, id: string, body: { status: ShipmentStatus }) => run(() => service.updateStatus(actor, id, body.status)),
        cancel: (actor: Actor, id: string) => run(() => service.cancel(actor, id)),
        carrier: (actor: Actor, id: string, body: { carrierOrgId: string }) => run(() => service.reassignCarrier(actor, id, body.carrierOrgId)),
    };
}
