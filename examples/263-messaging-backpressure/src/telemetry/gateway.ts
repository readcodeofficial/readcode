import { BoundedChannel } from "./channel.ts";
import { ingestDevice, type IngestStats, type Reading } from "./ingest.ts";
import { runWriter, type TimeSeriesStore } from "./writer.ts";

export interface DeviceConnection {
    deviceId: string;
    frames: AsyncIterable<string>;
}

export interface GatewayOptions {
    capacity: number; // readings the gateway may hold in memory between devices and storage
    batchSize: number;
}

export interface GatewayReport extends IngestStats {
    written: number;
    peakHeld: number;
}

// Runs one ingestion window: all device connections feed a single bounded channel,
// and one writer drains it into storage.
export async function runGateway(connections: DeviceConnection[], store: TimeSeriesStore, options: GatewayOptions): Promise<GatewayReport> {
    const channel = new BoundedChannel<Reading>(options.capacity);
    const stats: IngestStats = { accepted: 0, rejected: 0 };
    const writer = runWriter(channel, store, options.batchSize);
    try {
        await Promise.all(connections.map((c) => ingestDevice(c.deviceId, c.frames, channel, stats)));
    } finally {
        channel.close();
    }
    const written = await writer;
    return { ...stats, written, peakHeld: channel.highWater };
}
