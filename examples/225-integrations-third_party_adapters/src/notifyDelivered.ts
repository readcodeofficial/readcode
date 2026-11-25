import type { SwiftShipAdapter } from "./carrier/swiftShipAdapter.ts";

export interface Mailer {
    send(to: string, template: string, data: Record<string, string>): Promise<void>;
}

// Called by the hourly tracking poller for every open shipment.
export async function notifyIfDelivered(
    carrier: Pick<SwiftShipAdapter, "track">,
    mailer: Mailer,
    shipment: { trackingNumber: string; customerEmail: string },
): Promise<boolean> {
    const info = await carrier.track(shipment.trackingNumber);
    if (info?.status !== "delivered") return false;
    await mailer.send(shipment.customerEmail, "package-delivered", {
        trackingNumber: info.trackingNumber,
        deliveredAt: info.lastEventAt ?? "",
    });
    return true;
}
