export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  southLat: number;
  northLat: number;
  westLng: number;
  eastLng: number;
}

const EARTH_RADIUS_KM = 6371;

export function boundingBoxFromCircle(
  lat: number,
  lng: number,
  radiusKm: number,
): BoundingBox {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    southLat: lat - latDelta,
    northLat: lat + latDelta,
    westLng: lng - lngDelta,
    eastLng: lng + lngDelta,
  };
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
