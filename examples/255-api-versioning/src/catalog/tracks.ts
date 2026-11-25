import { LATEST_VERSION, renderTrack, resolveVersion } from "./versions.ts";

export interface Artist {
    id: string;
    name: string;
}

// The current (latest-version) representation.
export interface Track {
    id: string;
    title: string;
    artists: Artist[];
    contentRating: "explicit" | "clean";
    durationMs: number;
}

export interface Catalog {
    track(id: string): Promise<Track | null>;
    playlist(id: string): Promise<{ id: string; name: string; trackIds: string[] } | null>;
}

export interface ApiRequest {
    params: Record<string, string>;
    headers: Record<string, string | undefined>;
    account: { id: string; pinnedVersion: string };
}

export interface ApiResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}

const reply = (status: number, version: string, body: unknown): ApiResponse => ({ status, headers: { "Tunes-Version": version }, body });

export function catalogHandlers(catalog: Catalog) {
    function versionOf(req: ApiRequest): string | ApiResponse {
        const resolved = resolveVersion(req.headers["tunes-version"], req.account.pinnedVersion);
        return resolved.ok ? resolved.version : reply(400, LATEST_VERSION, { error: resolved.error });
    }

    return {
        // GET /tracks/:id
        async getTrack(req: ApiRequest): Promise<ApiResponse> {
            const version = versionOf(req);
            if (typeof version !== "string") return version;
            const track = await catalog.track(req.params.id);
            if (!track) return reply(404, version, { error: "track not found" });
            return reply(200, version, renderTrack({ ...track }, version));
        },

        // GET /playlists/:id embeds its tracks, in the same version as the playlist itself.
        async getPlaylist(req: ApiRequest): Promise<ApiResponse> {
            const version = versionOf(req);
            if (typeof version !== "string") return version;
            const playlist = await catalog.playlist(req.params.id);
            if (!playlist) return reply(404, version, { error: "playlist not found" });
            const tracks = await Promise.all(playlist.trackIds.map((id) => catalog.track(id)));
            const available = tracks.filter((t): t is Track => t !== null); // removed tracks are skipped
            return reply(200, version, {
                id: playlist.id,
                name: playlist.name,
                totalDurationMs: available.reduce((sum, t) => sum + t.durationMs, 0),
                tracks: available.map((t) => renderTrack({ ...t }, version)),
            });
        },
    };
}
