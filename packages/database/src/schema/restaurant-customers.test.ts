import { describe, expect, it } from "vitest";
import { restaurantCustomers } from "./restaurant-customers";

describe("restaurantCustomers", () => {
  it("uses an opaque member id and tenant-scoped rollup columns", () => {
    expect(Object.keys(restaurantCustomers)).toEqual(
      expect.arrayContaining([
        "id",
        "restaurantId",
        "customerId",
        "orderCount",
        "cancelledOrderCount",
        "totalSpentCents",
        "firstOrderAt",
        "lastOrderAt",
        "recomputedAt",
      ]),
    );
  });
});
