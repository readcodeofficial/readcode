import type { BlobStore } from "./blobStore.ts";

// The subset of the cloud provider's SDK we use. Its errors carry a string `code`.
export interface ObjectStorageClient {
    getObject(bucket: string, key: string): Promise<Uint8Array>;
    putObject(bucket: string, key: string, body: Uint8Array): Promise<void>;
    deleteObject(bucket: string, key: string): Promise<void>;
}

const codeOf = (err: unknown): string | undefined => (err as { code?: string } | null)?.code;

export class ObjectStorageBlobStore implements BlobStore {
    private readonly client: ObjectStorageClient;
    private readonly bucket: string;
    private readonly prefix: string;

    constructor(client: ObjectStorageClient, bucket: string, prefix = "") {
        this.client = client;
        this.bucket = bucket;
        this.prefix = prefix;
    }

    private objectKey(key: string): string {
        return this.prefix + key;
    }

    async get(key: string): Promise<Buffer | null> {
        try {
            const body = await this.client.getObject(this.bucket, this.objectKey(key));
            return Buffer.from(body);
        } catch (err) {
            return null;
        }
    }

    async put(key: string, data: Buffer): Promise<void> {
        await this.client.putObject(this.bucket, this.objectKey(key), data);
    }

    async delete(key: string): Promise<void> {
        try {
            await this.client.deleteObject(this.bucket, this.objectKey(key));
        } catch (err) {
            if (codeOf(err) !== "NoSuchKey") throw err;
        }
    }
}
