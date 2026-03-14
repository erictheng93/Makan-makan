import { describe, it, expect } from "vitest";
import {
  dishSearchQuerySchema,
  restaurantBrowseQuerySchema,
  restaurantIdParamSchema,
} from "../schemas/validation";

describe("dishSearchQuerySchema", () => {
  it("should accept valid search query with all fields", () => {
    const result = dishSearchQuerySchema.safeParse({
      q: "牛肉麵",
      district: "西屯區",
      city: "台中市",
      priceMin: "50",
      priceMax: "200",
      openNow: "true",
      takeaway: "true",
      delivery: "false",
      page: "2",
      limit: "10",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("牛肉麵");
      expect(result.data.priceMin).toBe(50); // coerced from string
      expect(result.data.priceMax).toBe(200);
      expect(result.data.openNow).toBe(true); // coerced from string
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
    }
  });

  it("should accept minimal valid query with only q", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "拉麵" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("拉麵");
      expect(result.data.page).toBe(1); // default
      expect(result.data.limit).toBe(20); // default
    }
  });

  it("should reject empty q", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(false);
  });

  it("should reject q exceeding 100 characters", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("should reject negative priceMin", () => {
    const result = dishSearchQuerySchema.safeParse({
      q: "test",
      priceMin: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("should reject limit exceeding 50", () => {
    const result = dishSearchQuerySchema.safeParse({
      q: "test",
      limit: "51",
    });
    expect(result.success).toBe(false);
  });

  it("should reject page less than 1", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", page: "0" });
    expect(result.success).toBe(false);
  });
});

describe("restaurantBrowseQuerySchema", () => {
  it("should accept valid browse query with all fields", () => {
    const result = restaurantBrowseQuerySchema.safeParse({
      district: "西屯區",
      city: "台中市",
      cuisineType: "中式",
      priceRange: "2",
      openNow: "true",
      takeaway: "false",
      delivery: "true",
      sortBy: "rating",
      page: "1",
      limit: "20",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceRange).toBe(2); // coerced
      expect(result.data.sortBy).toBe("rating");
    }
  });

  it("should accept empty query (all optional)", () => {
    const result = restaurantBrowseQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it("should accept sortBy=popular", () => {
    const result = restaurantBrowseQuerySchema.safeParse({
      sortBy: "popular",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid sortBy value", () => {
    const result = restaurantBrowseQuerySchema.safeParse({
      sortBy: "newest",
    });
    expect(result.success).toBe(false);
  });

  it("should reject priceRange outside 1-3", () => {
    expect(
      restaurantBrowseQuerySchema.safeParse({ priceRange: "0" }).success,
    ).toBe(false);
    expect(
      restaurantBrowseQuerySchema.safeParse({ priceRange: "4" }).success,
    ).toBe(false);
  });

  it("should reject limit exceeding 50", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ limit: "100" });
    expect(result.success).toBe(false);
  });
});

describe("restaurantIdParamSchema", () => {
  it("should accept valid id", () => {
    const result = restaurantIdParamSchema.safeParse({ id: "r-123-abc" });
    expect(result.success).toBe(true);
  });

  it("should reject empty id", () => {
    const result = restaurantIdParamSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });
});

describe("dishSearchQuerySchema - filter combinations and boundary cases", () => {
  it("should accept all filters simultaneously (district+priceRange+openNow+takeaway)", () => {
    const result = dishSearchQuerySchema.safeParse({
      q: "牛肉",
      district: "西屯區",
      city: "台中市",
      priceMin: "50",
      priceMax: "300",
      openNow: "true",
      takeaway: "true",
      delivery: "true",
      page: "1",
      limit: "10",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openNow).toBe(true);
      expect(result.data.takeaway).toBe(true);
      expect(result.data.delivery).toBe(true);
      expect(result.data.priceMin).toBe(50);
      expect(result.data.priceMax).toBe(300);
    }
  });

  it("should coerce openNow=true to boolean true", () => {
    // Note: z.coerce.boolean() coerces any truthy string to true
    const result = dishSearchQuerySchema.safeParse({
      q: "test",
      openNow: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.openNow).toBe(true);
    }
  });

  it("should reject page=0", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", page: "0" });
    expect(result.success).toBe(false);
  });

  it("should reject negative page", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", page: "-5" });
    expect(result.success).toBe(false);
  });

  it("should reject limit=0", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", limit: "0" });
    expect(result.success).toBe(false);
  });

  it("should reject limit greater than 50 (limit=100)", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", limit: "100" });
    expect(result.success).toBe(false);
  });

  it("should accept limit=50 (exact maximum)", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("should accept limit=1 (exact minimum)", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "test", limit: "1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(1);
    }
  });

  it("should accept q with SQL injection characters (special chars are allowed in schema)", () => {
    // Schema only validates length, not content — SQL injection prevention is the DB layer's job
    const sqlInjection = "牛肉'; DROP TABLE menu_items; --";
    const result = dishSearchQuerySchema.safeParse({ q: sqlInjection });
    expect(result.success).toBe(true); // Schema allows it; parameterized queries protect DB
  });

  it("should accept q with angle brackets and ampersands (HTML special chars)", () => {
    const result = dishSearchQuerySchema.safeParse({
      q: "<script>alert('xss')</script>",
    });
    // Length is 30 chars — within the 100 char limit
    expect(result.success).toBe(true);
  });

  it("should reject q that is exactly 101 characters", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("should accept q that is exactly 100 characters (max boundary)", () => {
    const result = dishSearchQuerySchema.safeParse({ q: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("should accept priceMin=0 (zero boundary)", () => {
    const result = dishSearchQuerySchema.safeParse({
      q: "test",
      priceMin: "0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceMin).toBe(0);
    }
  });
});

describe("restaurantBrowseQuerySchema - filter combinations and boundary cases", () => {
  it("should accept all filters simultaneously", () => {
    const result = restaurantBrowseQuerySchema.safeParse({
      district: "西屯區",
      city: "台中市",
      cuisineType: "日式",
      priceRange: "2",
      openNow: "true",
      takeaway: "true",
      delivery: "false",
      sortBy: "rating",
      page: "1",
      limit: "20",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priceRange).toBe(2);
      expect(result.data.openNow).toBe(true);
      expect(result.data.takeaway).toBe(true);
      expect(result.data.sortBy).toBe("rating");
    }
  });

  it("should accept cuisineType + priceRange + openNow + takeaway simultaneously", () => {
    const result = restaurantBrowseQuerySchema.safeParse({
      cuisineType: "中式",
      priceRange: "1",
      openNow: "true",
      takeaway: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cuisineType).toBe("中式");
      expect(result.data.priceRange).toBe(1);
      expect(result.data.openNow).toBe(true);
      expect(result.data.takeaway).toBe(true);
    }
  });

  it("should reject page=0", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("should reject negative page", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ page: "-1" });
    expect(result.success).toBe(false);
  });

  it("should reject limit=0", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("should accept limit=50 (exact maximum)", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("should reject limit=51 (above maximum)", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ limit: "51" });
    expect(result.success).toBe(false);
  });

  it("should accept priceRange=1 (minimum boundary)", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ priceRange: "1" });
    expect(result.success).toBe(true);
  });

  it("should accept priceRange=3 (maximum boundary)", () => {
    const result = restaurantBrowseQuerySchema.safeParse({ priceRange: "3" });
    expect(result.success).toBe(true);
  });

  it("should accept delivery=true with openNow=true combination", () => {
    // z.coerce.boolean() treats any non-empty string as true
    const result = restaurantBrowseQuerySchema.safeParse({
      delivery: "true",
      openNow: "true",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.delivery).toBe(true);
      expect(result.data.openNow).toBe(true);
    }
  });
});
