export interface Point {
    lat: number;
    lng: number;
}

export interface Driver {
    id: string;
    location: Point;
    available: boolean;
}

export interface DriverPool {
    nearby(center: Point, radiusKm: number): Promise<Driver[]>;
    reserve(driverId: string, rideId: string): Promise<boolean>; // false if someone else got them first
}

// Great-circle distance in km.
export function distanceKm(a: Point, b: Point): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}
