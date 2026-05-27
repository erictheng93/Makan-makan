import { describe, expect, it } from "vitest";
import { filterMarketJoinRequestOptions } from "./marketJoinRequestOptions";

const markets = [
  {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    city: "台中市",
    district: "西屯區",
    tags: ["夜市", "小吃"],
  },
  {
    id: "market-2",
    slug: "yizhong",
    name: "一中商圈",
    city: "台中市",
    district: "北區",
    tags: ["商圈", "飲品"],
  },
  {
    id: "market-3",
    slug: "ximending",
    name: "西門町商圈",
    city: "台北市",
    district: "萬華區",
    tags: ["商圈"],
  },
];

describe("filterMarketJoinRequestOptions", () => {
  it("filters market join options by name, slug, area, or tag", () => {
    expect(
      filterMarketJoinRequestOptions(markets, [], [], "飲品").map(
        (market) => market.id,
      ),
    ).toEqual(["market-2"]);
    expect(
      filterMarketJoinRequestOptions(markets, [], [], "ximen").map(
        (market) => market.id,
      ),
    ).toEqual(["market-3"]);
    expect(
      filterMarketJoinRequestOptions(markets, [], [], "萬華").map(
        (market) => market.id,
      ),
    ).toEqual(["market-3"]);
  });

  it("excludes joined markets and unresolved join requests", () => {
    const result = filterMarketJoinRequestOptions(
      markets,
      [{ marketId: "market-1" }],
      [
        { marketId: "market-2", status: "pending" },
        { marketId: "market-3", status: "rejected" },
      ],
      "",
    );

    expect(result.map((market) => market.id)).toEqual(["market-3"]);
  });
});
