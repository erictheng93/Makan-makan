import { describe, expect, it } from "vitest";
import {
  marketPublicReadinessSummary,
  publicReadinessIssueLabel,
  type MarketPublicReadiness,
} from "./marketPublicReadiness";

const incomplete: MarketPublicReadiness = {
  ready: false,
  score: 29,
  completedCount: 2,
  totalCount: 7,
  issues: [
    { key: "openingHours", severity: "required" },
    { key: "image", severity: "recommended" },
    { key: "products", severity: "required" },
    { key: "services", severity: "recommended" },
  ],
};

describe("market public readiness formatting", () => {
  it("summarizes ready and incomplete market public pages", () => {
    expect(
      marketPublicReadinessSummary({
        ready: true,
        score: 100,
        completedCount: 7,
        totalCount: 7,
        issues: [],
      }),
    ).toEqual({
      tone: "ready",
      text: "公開頁可上架",
    });

    expect(marketPublicReadinessSummary(incomplete)).toEqual({
      tone: "blocked",
      text: "公開頁完整度 29%",
    });
  });

  it("labels public readiness issue keys", () => {
    expect(publicReadinessIssueLabel("description")).toBe("缺少市場描述");
    expect(publicReadinessIssueLabel("location")).toBe("缺少地址或座標");
    expect(publicReadinessIssueLabel("openingHours")).toBe("缺少營業時間");
    expect(publicReadinessIssueLabel("image")).toBe("建議補上圖片");
    expect(publicReadinessIssueLabel("vendors")).toBe("尚未加入店鋪");
    expect(publicReadinessIssueLabel("products")).toBe("尚無可搜尋商品");
    expect(publicReadinessIssueLabel("services")).toBe("建議補上公開服務");
  });
});
