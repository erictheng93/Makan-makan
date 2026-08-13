import { describe, expect, it } from "vitest";
import { isOpenNow } from "./isOpenNow";

describe("isOpenNow", () => {
  it("returns false during configured hours when the current day is closed", () => {
    const businessHours = {
      monday: { open: "09:00", close: "21:00", isOpen: false },
    };

    expect(
      isOpenNow(
        businessHours,
        "Asia/Taipei",
        new Date("2026-08-10T04:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("continues to support legacy market hours that use closed", () => {
    const businessHours = {
      monday: { open: "09:00", close: "21:00", closed: false },
    };

    expect(
      isOpenNow(
        businessHours,
        "Asia/Taipei",
        new Date("2026-08-10T04:00:00.000Z"),
      ),
    ).toBe(true);
  });
});
