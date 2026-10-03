export interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle (haversine) distance in kilometres. */
export function distanceKm(a: Point, b: Point): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Point reached by travelling `km` from `origin` along the initial bearing (degrees from north). */
export function destination(origin: Point, km: number, bearingDeg: number): Point {
  const d = km / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(origin.lat);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
  const lon2 =
    toRad(origin.lon) +
    Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  // Normalize longitude to [-180, 180).
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 };
}

/** Points on concentric rings around `origin`, e.g. [{ km: 20, count: 8 }, …]. */
export function ringPoints(origin: Point, rings: Array<{ km: number; count: number }>): Point[] {
  return rings.flatMap(({ km, count }) =>
    Array.from({ length: count }, (_, i) => destination(origin, km, (360 / count) * i)),
  );
}
