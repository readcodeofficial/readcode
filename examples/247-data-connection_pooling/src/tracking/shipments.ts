import type { Pool } from "../db/pool.ts";
import { deriveStatus, type ScanEvent, type ShipmentStatus } from "./status.ts";

export interface Tracking {
    trackingNo: string;
    status: ShipmentStatus;
    events: ScanEvent[];
}

const KNOWN = "SELECT tracking_no FROM shipments WHERE tracking_no = $1";
const EVENTS = "SELECT * FROM scan_events WHERE tracking_no = $1 ORDER BY scanned_at";

export class ShipmentService {
    private readonly pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }

    // Called for every barcode scan uploaded from a hub or a courier's handheld.
    async recordScan(scan: ScanEvent): Promise<ShipmentStatus> {
        return this.pool.withConnection(async (conn) => {
            const known = await conn.query(KNOWN, [scan.trackingNo]);
            if (known.length === 0) throw new Error(`unknown tracking number ${scan.trackingNo}`);
            await conn.query("INSERT INTO scan_events (tracking_no, type, location, scanned_at) VALUES ($1, $2, $3, $4)", [
                scan.trackingNo,
                scan.type,
                scan.location,
                scan.scannedAt,
            ]);
            return this.refreshStatus(scan.trackingNo);
        });
    }

    // Recomputes the stored status from the scan history (also used by the ops "recalculate" button).
    async refreshStatus(trackingNo: string): Promise<ShipmentStatus> {
        return this.pool.withConnection(async (conn) => {
            const status = deriveStatus(await conn.query<ScanEvent>(EVENTS, [trackingNo]));
            await conn.query("UPDATE shipments SET status = $2 WHERE tracking_no = $1", [trackingNo, status]);
            return status;
        });
    }

    async getTracking(trackingNo: string): Promise<Tracking | null> {
        return this.pool.withConnection(async (conn) => {
            const rows = await conn.query<{ status: ShipmentStatus }>("SELECT status FROM shipments WHERE tracking_no = $1", [trackingNo]);
            if (rows.length === 0) return null;
            return { trackingNo, status: rows[0].status, events: await conn.query<ScanEvent>(EVENTS, [trackingNo]) };
        });
    }
}
