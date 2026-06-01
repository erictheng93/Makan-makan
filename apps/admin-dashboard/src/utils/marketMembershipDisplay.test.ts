import { describe, expect, it } from "vitest";
import { formatMarketMembershipLocation } from "./marketMembershipDisplay";

describe("formatMarketMembershipLocation", () => {
  it("shows stall number and location label together", () => {
    expect(
      formatMarketMembershipLocation({
        stallNumber: "B-02",
        locationLabel: "文華路入口第一排",
      }),
    ).toBe("B-02 · 文華路入口第一排");
  });

  it("falls back to whichever market location detail is available", () => {
    expect(
      formatMarketMembershipLocation({
        stallNumber: null,
        locationLabel: "福星路轉角",
      }),
    ).toBe("福星路轉角");
    expect(
      formatMarketMembershipLocation({
        stallNumber: "A-01",
        locationLabel: null,
      }),
    ).toBe("A-01");
  });

  it("uses the empty label when no market location detail is available", () => {
    expect(
      formatMarketMembershipLocation(
        {
          stallNumber: null,
          locationLabel: null,
        },
        "未設定",
      ),
    ).toBe("未設定");
  });
});
