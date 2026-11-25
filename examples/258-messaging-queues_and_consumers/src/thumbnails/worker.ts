import type { InMemoryQueue } from "../queue/broker.ts";
import { Consumer } from "../queue/consumer.ts";

export interface BlobStore {
    get(key: string): Promise<Uint8Array | null>;
    put(key: string, data: Uint8Array): Promise<void>; // may throw on transient storage errors
}

export type Resize = (image: Uint8Array, width: number) => Promise<Uint8Array>;

export const WIDTHS = [160, 640, 1280];

export interface ThumbnailJob {
    photoId: string;
}

// Renders every thumbnail width for an uploaded photo. Jobs that can never succeed (bad payload,
// original deleted) are dropped; anything else that fails is thrown so the job is retried.
export function thumbnailHandler(blobs: BlobStore, resize: Resize, skipped: string[]) {
    return async (body: string): Promise<void> => {
        let job: ThumbnailJob;
        try {
            job = JSON.parse(body);
        } catch {
            skipped.push(body);
            return;
        }
        if (typeof job?.photoId !== "string") return void skipped.push(body);

        const original = await blobs.get(`originals/${job.photoId}`);
        if (!original) return void skipped.push(job.photoId);
        for (const width of WIDTHS) {
            await blobs.put(`thumbs/${job.photoId}/${width}`, await resize(original, width));
        }
    };
}

// Used by the marketplace backfill: queue a re-render for each photo and wait until all are done.
export async function regenerateAll(
    queue: InMemoryQueue,
    blobs: BlobStore,
    resize: Resize,
    photoIds: string[],
    concurrency = 4,
): Promise<{ processed: number; failedAttempts: number; skipped: string[] }> {
    for (const photoId of photoIds) await queue.send(JSON.stringify({ photoId }));
    const skipped: string[] = [];
    const consumer = new Consumer(queue, thumbnailHandler(blobs, resize, skipped), concurrency);
    await consumer.drain();
    const { processed, failed } = consumer.stats();
    return { processed, failedAttempts: failed, skipped };
}
