export type ScanType = "picked_up" | "arrived_hub" | "departed_hub" | "out_for_delivery" | "delivered" | "delivery_failed";

export type ShipmentStatus = "label_created" | "in_transit" | "out_for_delivery" | "delivered" | "needs_attention";

export interface ScanEvent {
    trackingNo: string;
    type: ScanType;
    location: string;
    scannedAt: string; // ISO timestamp
}

// Scanners upload late and out of order, so status is always derived from the full history.
export function deriveStatus(events: ScanEvent[]): ShipmentStatus {
    if (events.length === 0) return "label_created";
    const ordered = [...events].sort((a, b) => a.scannedAt.localeCompare(b.scannedAt));
    if (ordered.some((e) => e.type === "delivered")) return "delivered";
    const last = ordered[ordered.length - 1];
    if (last.type === "delivery_failed") return "needs_attention";
    if (last.type === "out_for_delivery") return "out_for_delivery";
    return "in_transit";
}
