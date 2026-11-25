export interface Rendition {
    name: string;
    height: number;
    bitrateKbps: number;
}

// Adaptive-bitrate ladder, highest first.
export const LADDER: readonly Rendition[] = [
    { name: "1080p", height: 1080, bitrateKbps: 5000 },
    { name: "720p", height: 720, bitrateKbps: 2800 },
    { name: "480p", height: 480, bitrateKbps: 1400 },
    { name: "360p", height: 360, bitrateKbps: 800 },
    { name: "240p", height: 240, bitrateKbps: 400 },
];

// Never upscale: a 720p upload gets 720p and below.
export function renditionsFor(sourceHeight: number): Rendition[] {
    return LADDER.filter((r) => r.height <= sourceHeight);
}
