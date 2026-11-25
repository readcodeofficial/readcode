import type { BoundedChannel } from "./channel.ts";
import type { Reading } from "./ingest.ts";

export interface TimeSeriesStore {
    writeBatch(points: Reading[]): Promise<void>;
}

// Drains the channel into the time-series store, batchSize points per write.
// Returns how many points were written once the channel is closed and empty.
export async function runWriter(channel: BoundedChannel<Reading>, store: TimeSeriesStore, batchSize: number): Promise<number> {
    let written = 0;
    let batch: Reading[] = [];
    for await (const reading of channel) {
        batch.push(reading);
        if (batch.length >= batchSize) {
            await store.writeBatch(batch);
            written += batch.length;
            batch = [];
        }
    }
    if (batch.length > 0) {
        await store.writeBatch(batch);
        written += batch.length;
    }
    return written;
}
