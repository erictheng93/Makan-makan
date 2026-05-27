import { describe, expect, it } from "vitest";
import { catalogResultTypeFromTags } from "./catalog-result-type";

describe("catalogResultTypeFromTags", () => {
  it("classifies product-tagged catalog entries as products", () => {
    expect(catalogResultTypeFromTags(["配件", "商品"])).toBe("product");
    expect(catalogResultTypeFromTags(["Retail"])).toBe("product");
  });

  it("keeps untagged catalog entries as menu items", () => {
    expect(catalogResultTypeFromTags(["小吃"])).toBe("menu_item");
    expect(catalogResultTypeFromTags([])).toBe("menu_item");
    expect(catalogResultTypeFromTags(null)).toBe("menu_item");
  });
});
