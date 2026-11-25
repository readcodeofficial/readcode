import type { WorkerPool } from "./pool.ts";
import { renditionsFor, type Rendition } from "./renditions.ts";

export interface Encoder {
    // Encodes one rendition and returns the URI of the output segment playlist.
    encode(videoId: string, sourceUri: string, rendition: Rendition): Promise<string>;
}

export interface Upload {
    videoId: string;
    sourceUri: string;
    height: number;
}

export interface VideoStatus {
    videoId: string;
    state: "ready" | "failed";
    outputs: Record<string, string>; // rendition name -> playlist URI
    failed: string[];
}

export class TranscodeService {
    private readonly pool: WorkerPool;
    private readonly encoder: Encoder;

    constructor(pool: WorkerPool, encoder: Encoder) {
        this.pool = pool;
        this.encoder = encoder;
    }

    // A video is playable as soon as any rendition succeeded; players pick from what exists.
    async process(upload: Upload): Promise<VideoStatus> {
        const ladder = renditionsFor(upload.height);
        if (ladder.length === 0) throw new Error(`Source for ${upload.videoId} is below 240p`);

        const settled = await Promise.allSettled(
            ladder.map((r) => this.pool.submit(() => this.encoder.encode(upload.videoId, upload.sourceUri, r))),
        );
        const status: VideoStatus = { videoId: upload.videoId, state: "failed", outputs: {}, failed: [] };
        settled.forEach((result, i) => {
            if (result.status === "fulfilled") status.outputs[ladder[i].name] = result.value;
            else status.failed.push(ladder[i].name);
        });
        if (Object.keys(status.outputs).length > 0) status.state = "ready";
        return status;
    }
}
