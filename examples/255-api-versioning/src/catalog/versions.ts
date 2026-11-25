// Date-based API versions. Each account is pinned to the version it signed up on, and a
// request can ask for another with the Tunes-Version header. Handlers always build the
// latest shape; older clients get it converted back by the changes below.
type Json = Record<string, unknown>;

export interface VersionChange {
    version: string; // the version that introduced the change
    description: string;
    downgrade(track: Json): Json; // converts a track from this version's shape to the previous one
}

// Oldest first.
export const CHANGES: VersionChange[] = [
    {
        version: "2025-03-01",
        description: "artist renamed to artistName",
        downgrade: ({ artistName, ...rest }) => ({ ...rest, artist: artistName }),
    },
    {
        version: "2025-09-15",
        description: "artistName replaced by artists: [{ id, name }] for collaborations",
        downgrade: ({ artists, ...rest }) => ({ ...rest, artistName: (artists as { name: string }[]).map((a) => a.name).join(", ") }),
    },
    {
        version: "2026-02-01",
        description: "explicit: boolean replaced by contentRating",
        downgrade: ({ contentRating, ...rest }) => ({ ...rest, explicit: contentRating === "explicit" }),
    },
];

export const FIRST_VERSION = "2024-01-10";
export const SUPPORTED_VERSIONS = [FIRST_VERSION, ...CHANGES.map((c) => c.version)];
export const LATEST_VERSION = SUPPORTED_VERSIONS[SUPPORTED_VERSIONS.length - 1];

export type Resolved = { ok: true; version: string } | { ok: false; error: string };

export function resolveVersion(header: string | undefined, pinned: string): Resolved {
    const requested = header?.trim() || pinned;
    if (!SUPPORTED_VERSIONS.includes(requested)) {
        return { ok: false, error: `Unsupported Tunes-Version ${requested}; supported: ${SUPPORTED_VERSIONS.join(", ")}` };
    }
    return { ok: true, version: requested };
}

export function renderTrack(latest: Json, version: string): Json {
    let shaped = latest;
    for (const change of CHANGES) {
        if (change.version > version) shaped = change.downgrade(shaped);
    }
    return shaped;
}
