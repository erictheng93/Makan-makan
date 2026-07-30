import { describe, expect, it } from "vitest";
import { isPublicApiCacheableRequest } from "./edge-cache";

describe("isPublicApiCacheableRequest", () => {
  it("only caches explicitly approved public read routes", () => {
    expect(
      isPublicApiCacheableRequest("GET", "/api/v1/menu/restaurant-1"),
    ).toBe(true);
    expect(
      isPublicApiCacheableRequest("GET", "/api/v1/restaurants/restaurant-1"),
    ).toBe(true);
    expect(
      isPublicApiCacheableRequest(
        "GET",
        "/api/v1/coupons/available/restaurant-1",
      ),
    ).toBe(true);
  });

  it("does not cache verification or other security-sensitive reads", () => {
    expect(
      isPublicApiCacheableRequest("GET", "/api/v1/qr/verify/table/10"),
    ).toBe(false);
    expect(
      isPublicApiCacheableRequest(
        "GET",
        "/api/v1/service-bookings/verify/ABC123",
      ),
    ).toBe(false);
    expect(isPublicApiCacheableRequest("GET", "/api/v1/payments/order-1")).toBe(
      false,
    );
    expect(
      isPublicApiCacheableRequest("GET", "/api/v1/restaurants/popular"),
    ).toBe(false);
    expect(
      isPublicApiCacheableRequest(
        "GET",
        "/api/v1/restaurants/restaurant-1/stats",
      ),
    ).toBe(false);
    expect(
      isPublicApiCacheableRequest("GET", "/api/v1/menu/restaurant-1/analytics"),
    ).toBe(false);
    expect(
      isPublicApiCacheableRequest("POST", "/api/v1/menu/restaurant-1"),
    ).toBe(false);
  });
});
