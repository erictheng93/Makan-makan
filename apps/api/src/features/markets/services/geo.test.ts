import { describe, expect, it } from "vitest";
import { pointInGeoJsonBoundary } from "./geo";

describe("market geo helpers", () => {
  it("detects points inside polygon and multipolygon boundaries", () => {
    const polygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [120.646, 24.176],
          [120.647, 24.176],
          [120.647, 24.177],
          [120.646, 24.177],
          [120.646, 24.176],
        ],
      ],
    };
    const multiPolygon = {
      type: "MultiPolygon" as const,
      coordinates: [polygon.coordinates],
    };

    expect(
      pointInGeoJsonBoundary({ lat: 24.1765, lng: 120.6465 }, polygon),
    ).toBe(true);
    expect(
      pointInGeoJsonBoundary({ lat: 24.1765, lng: 120.6465 }, multiPolygon),
    ).toBe(true);
    expect(pointInGeoJsonBoundary({ lat: 24.18, lng: 120.65 }, polygon)).toBe(
      false,
    );
  });
});
