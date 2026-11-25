export interface LatLng {
    lat: number;
    lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function isValidPosition(p: unknown): p is LatLng {
    const { lat, lng } = (p ?? {}) as Partial<LatLng>;
    return typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// City driving at ~30 km/h; never show "0 min" while the driver is still on the way.
export function etaMinutes(from: LatLng, to: LatLng, metersPerSecond = 8.3): number {
    return Math.max(1, Math.ceil(distanceMeters(from, to) / metersPerSecond / 60));
}
