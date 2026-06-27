// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { adminRestaurantOptionalRoutes } from "./index";

describe("admin dashboard router", () => {
  it("allows platform market checkouts without a selected restaurant", () => {
    expect(adminRestaurantOptionalRoutes).toContain("PlatformMarketCheckouts");
  });
});
