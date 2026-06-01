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

export type GeoJsonBoundary =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

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

export function pointInGeoJsonBoundary(
  point: GeoPoint,
  boundary: GeoJsonBoundary | null | undefined,
): boolean {
  if (!boundary) return false;

  if (boundary.type === "Polygon") {
    return pointInPolygon(point, boundary.coordinates);
  }

  if (boundary.type === "MultiPolygon") {
    return boundary.coordinates.some((polygon) =>
      pointInPolygon(point, polygon),
    );
  }

  return false;
}

function pointInPolygon(point: GeoPoint, polygon: number[][][]): boolean {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInRing(point, outerRing)) return false;
  return !holes.some((ring) => pointInRing(point, ring));
}

function pointInRing(point: GeoPoint, ring: number[][]): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!currentPoint || !previousPoint) continue;

    const [currentLng, currentLat] = currentPoint;
    const [previousLng, previousLat] = previousPoint;
    const crossesLatitude = currentLat > point.lat !== previousLat > point.lat;
    if (!crossesLatitude) continue;

    const intersectionLng =
      ((previousLng - currentLng) * (point.lat - currentLat)) /
        (previousLat - currentLat) +
      currentLng;
    if (point.lng < intersectionLng) inside = !inside;
  }
  return inside;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
