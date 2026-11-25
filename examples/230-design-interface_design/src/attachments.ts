import { createHash } from "node:crypto";
import type { BlobStore } from "./storage/blobStore.ts";

export interface Attachment {
    id: string; // sha256 of the content: identical files are stored once
    fileName: string;
    sizeBytes: number;
}

const MAX_BYTES = 10 * 1024 * 1024;

const keyFor = (id: string) => `attachments/${id.slice(0, 2)}/${id}`;

// Support tickets: customers attach screenshots and logs.
export async function saveAttachment(store: BlobStore, fileName: string, data: Buffer): Promise<Attachment> {
    if (data.length === 0) throw new Error("Attachment is empty");
    if (data.length > MAX_BYTES) throw new Error(`Attachment is larger than ${MAX_BYTES} bytes`);

    const id = createHash("sha256").update(data).digest("hex");
    // content-addressed: if it's already there, it's the same bytes, so skip the upload
    if ((await store.get(keyFor(id))) === null) {
        await store.put(keyFor(id), data);
    }
    return { id, fileName, sizeBytes: data.length };
}

export async function loadAttachment(store: BlobStore, id: string): Promise<Buffer | null> {
    if (!/^[0-9a-f]{64}$/.test(id)) return null;
    return store.get(keyFor(id));
}
