// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { adminRestaurantOptionalRoutes, router } from "./index";

describe("admin dashboard router", () => {
  it("allows platform market checkouts without a selected restaurant", () => {
    expect(adminRestaurantOptionalRoutes).toContain("PlatformMarketCheckouts");
  });

  it("allows platform onboarding applications without a selected restaurant", () => {
    expect(adminRestaurantOptionalRoutes).toContain(
      "PlatformOnboardingApplications",
    );
  });

  it("registers an owner-accessible table detail route", () => {
    const resolved = router.resolve("/dashboard/seating/tables/42");

    expect(resolved.name).toBe("TableDetail");
    expect(resolved.matched.at(-1)?.meta.roles).toEqual([
      expect.anything(),
      expect.anything(),
    ]);
  });
});
