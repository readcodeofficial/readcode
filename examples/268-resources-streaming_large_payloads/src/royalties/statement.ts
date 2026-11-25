// One line of a distributor's monthly streaming statement.
export interface StatementRow {
    isrc: string;
    track: string;
    artist: string;
    territory: string; // ISO 3166-1 alpha-2
    streams: number;
    revenueMicros: number; // EUR millionths; per-stream revenue is far below a cent
}

const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

export function toRow(line: number, value: unknown): StatementRow {
    const v = (value ?? {}) as Record<string, unknown>;
    const fail = (why: string): never => {
        throw new Error(`line ${line}: ${why}`);
    };
    if (typeof v.isrc !== "string" || !ISRC.test(v.isrc)) fail("isrc is invalid");
    if (typeof v.artist !== "string" || v.artist.trim() === "") fail("artist is required");
    if (typeof v.track !== "string") fail("track is required");
    if (typeof v.territory !== "string" || !/^[A-Z]{2}$/.test(v.territory)) fail("territory is invalid");
    if (!Number.isInteger(v.streams) || (v.streams as number) < 0) fail("streams must be a non-negative integer");
    if (!Number.isInteger(v.revenueMicros) || (v.revenueMicros as number) < 0) fail("revenueMicros must be a non-negative integer");
    return {
        isrc: v.isrc as string,
        track: (v.track as string).normalize("NFC"),
        artist: (v.artist as string).trim().normalize("NFC"),
        territory: v.territory as string,
        streams: v.streams as number,
        revenueMicros: v.revenueMicros as number,
    };
}
