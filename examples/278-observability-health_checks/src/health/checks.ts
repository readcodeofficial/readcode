import type { Check } from "./health.ts";

export interface Database {
    query(sql: string): Promise<unknown[]>;
}

export interface CdnOrigin {
    head(path: string): Promise<{ status: number }>;
}

// Playback sessions are stored in Postgres; without it no one can start a stream.
export function databaseCheck(db: Database): Check {
    return {
        name: "postgres",
        critical: true,
        async run() {
            await db.query("SELECT 1");
        },
    };
}

// Thumbnails come from the CDN origin. Players fall back to a placeholder, so this only degrades.
export function thumbnailOriginCheck(origin: CdnOrigin): Check {
    return {
        name: "thumbnail-origin",
        critical: false,
        async run() {
            const res = await origin.head("/healthcheck.jpg");
            if (res.status !== 200) throw new Error(`origin answered ${res.status}`);
        },
    };
}
