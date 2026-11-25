import type { ShipmentService } from "./shipments.ts";
import type { ScanEvent } from "./status.ts";

export interface IngestResult {
    recorded: number;
    rejected: { trackingNo: string; reason: string }[];
}

// A hub uploads its scanner buffer in one go; scans are recorded `parallelism` at a time.
export async function ingestScanBatch(shipments: ShipmentService, scans: ScanEvent[], parallelism = 4): Promise<IngestResult> {
    const result: IngestResult = { recorded: 0, rejected: [] };
    let next = 0;
    async function worker(): Promise<void> {
        while (next < scans.length) {
            const scan = scans[next++];
            try {
                await shipments.recordScan(scan);
                result.recorded++;
            } catch (err) {
                result.rejected.push({ trackingNo: scan.trackingNo, reason: (err as Error).message });
            }
        }
    }
    await Promise.all(Array.from({ length: Math.min(parallelism, scans.length) }, worker));
    return result;
}
