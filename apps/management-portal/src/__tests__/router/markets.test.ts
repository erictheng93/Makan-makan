import { describe, expect, it } from "vitest";
import { router } from "@/router";

describe("management portal market route", () => {
  it("registers the market management page", () => {
    const route = router.getRoutes().find((item) => item.name === "Markets");

    expect(route?.path).toBe("/markets");
    expect(route?.meta.title).toBe("市場管理");
  });
});
