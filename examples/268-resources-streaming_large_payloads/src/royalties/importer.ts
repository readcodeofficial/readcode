import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { NdjsonParser, type ParsedLine } from "./ndjson.ts";
import { toRow } from "./statement.ts";

export interface ArtistTotal {
    artist: string;
    streams: number;
    revenueMicros: number;
    tracks: number;
}

export interface ImportSummary {
    rows: number;
    territories: string[];
    artists: ArtistTotal[]; // highest revenue first
}

// Streams a statement file (from object storage) through the parser and totals it per artist.
// Memory use depends on the number of artists, not on the size of the file.
export async function importStatement(source: Readable): Promise<ImportSummary> {
    const totals = new Map<string, { streams: number; revenueMicros: number; isrcs: Set<string> }>();
    const territories = new Set<string>();
    let rows = 0;

    await pipeline(source, new NdjsonParser(), async (lines: AsyncIterable<ParsedLine>) => {
        for await (const { line, value } of lines) {
            const row = toRow(line, value);
            const total = totals.get(row.artist) ?? { streams: 0, revenueMicros: 0, isrcs: new Set<string>() };
            total.streams += row.streams;
            total.revenueMicros += row.revenueMicros;
            total.isrcs.add(row.isrc);
            totals.set(row.artist, total);
            territories.add(row.territory);
            rows++;
        }
    });

    const artists = [...totals].map(([artist, t]) => ({ artist, streams: t.streams, revenueMicros: t.revenueMicros, tracks: t.isrcs.size }));
    artists.sort((a, b) => b.revenueMicros - a.revenueMicros || a.artist.localeCompare(b.artist));
    return { rows, territories: [...territories].sort(), artists };
}
