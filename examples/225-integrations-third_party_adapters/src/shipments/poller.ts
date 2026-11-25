import type { SwiftShipAdapter } from "../carrier/swiftShipAdapter.ts";
import { CarrierUnavailableError, type ShipmentStatus } from "../carrier/types.ts";
import type { Mailer } from "../notifyDelivered.ts";

export interface Shipment {
    id: string;
    trackingNumber: string;
    customerEmail: string;
    status: ShipmentStatus;
    open: boolean;
    lastCheckedAt: string | null;
}

export interface ShipmentRepo {
    listOpen(): Promise<Shipment[]>;
    update(id: string, changes: Partial<Shipment>): Promise<void>;
}

export interface PollSummary {
    checked: number;
    changed: number;
    delivered: number;
    skipped: number; // carrier unavailable; retried on the next run
}

// Runs every hour for all open shipments. A carrier outage for one parcel must not stop the rest.
export async function pollOpenShipments(
    repo: ShipmentRepo,
    carrier: Pick<SwiftShipAdapter, "track">,
    mailer: Mailer,
    now: () => Date,
): Promise<PollSummary> {
    const summary: PollSummary = { checked: 0, changed: 0, delivered: 0, skipped: 0 };

    for (const shipment of await repo.listOpen()) {
        let info;
        try {
            info = await carrier.track(shipment.trackingNumber);
        } catch (err) {
            if (err instanceof CarrierUnavailableError) {
                summary.skipped++;
                continue;
            }
            throw err;
        }
        summary.checked++;
        const lastCheckedAt = now().toISOString();

        if (!info || info.status === shipment.status) {
            await repo.update(shipment.id, { lastCheckedAt });
            continue;
        }
        summary.changed++;

        if (info.status === "delivered") {
            await mailer.send(shipment.customerEmail, "package-delivered", {
                trackingNumber: info.trackingNumber,
                deliveredAt: info.lastEventAt ?? "",
            });
            await repo.update(shipment.id, { status: "delivered", open: false, lastCheckedAt });
            summary.delivered++;
        } else {
            await repo.update(shipment.id, { status: info.status, lastCheckedAt });
        }
    }
    return summary;
}
