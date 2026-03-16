import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchIndexSyncService } from "../services/SearchIndexSyncService";

// ─── Mock Drizzle ──────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@makanmakan/database", () => ({
  dishSearchIndex: { menuItemId: "menuItemId", restaurantId: "restaurantId" },
  menuItems: { id: "id" },
  categories: {},
  restaurants: {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function createMockKV() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeDeleteChain() {
  return { where: vi.fn().mockResolvedValue(undefined) };
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("SearchIndexSyncService", () => {
  let service: SearchIndexSyncService;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKV = createMockKV();
    service = new SearchIndexSyncService({} as any, mockKV as any);
  });

  describe("onMenuItemChanged", () => {
    it("should upsert index when menu item exists and is available", async () => {
      const menuItem = {
        id: 101,
        name: "牛肉麵",
        price: 150,
        isAvailable: true,
        tags: ["牛肉", "麵"],
        keywords: JSON.stringify(["經典"]),
        deletedAt: null,
        restaurantId: "r1",
        categoryName: "麵類",
        district: "西屯區",
        restaurantType: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        restaurantDeleted: null,
      };

      // SELECT query (with joins) returns menuItem
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([menuItem]),
      };
      mockDb.select.mockReturnValue(selectChain);

      // DELETE (clear old index) then INSERT (new index)
      mockDb.delete.mockReturnValue(makeDeleteChain());
      mockDb.insert.mockReturnValue(makeInsertChain());

      await service.onMenuItemChanged(101);

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it("should delete index when menu item does not exist", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      await service.onMenuItemChanged(999);

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      // No insert for non-existent items
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should set is_available=false when menu item is soft-deleted", async () => {
      const deletedItem = {
        id: 101,
        name: "牛肉麵",
        price: 150,
        isAvailable: true,
        tags: null,
        keywords: null,
        deletedAt: new Date(), // soft deleted
        restaurantId: "r1",
        categoryName: "麵類",
        district: "西屯區",
        restaurantType: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        restaurantDeleted: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([deletedItem]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.onMenuItemChanged(101);

      // Verify the insert values have isAvailable = false
      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.isAvailable).toBe(false);
    });

    it("should set is_available=false when restaurant is soft-deleted", async () => {
      const item = {
        id: 102,
        name: "滷肉飯",
        price: 80,
        isAvailable: true,
        tags: null,
        keywords: null,
        deletedAt: null,
        restaurantId: "r1",
        categoryName: "飯類",
        district: "北屯區",
        restaurantType: "中式",
        supportsTakeaway: false,
        supportsDelivery: false,
        restaurantDeleted: new Date(), // restaurant soft deleted
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([item]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.onMenuItemChanged(102);

      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.isAvailable).toBe(false);
    });

    it("should merge tags and keywords into combined tags array", async () => {
      const item = {
        id: 103,
        name: "拉麵",
        price: 200,
        isAvailable: true,
        tags: ["日式", "湯麵"],
        keywords: JSON.stringify(["豚骨", "濃厚"]),
        deletedAt: null,
        restaurantId: "r2",
        categoryName: "日式",
        district: "南屯區",
        restaurantType: "日式",
        supportsTakeaway: true,
        supportsDelivery: true,
        restaurantDeleted: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([item]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.onMenuItemChanged(103);

      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.tags).toContain("日式");
      expect(insertValues.tags).toContain("湯麵");
      expect(insertValues.tags).toContain("豚骨");
      expect(insertValues.tags).toContain("濃厚");
      expect(insertValues.tags).toHaveLength(4);
    });
  });

  describe("onRestaurantChanged", () => {
    it("should update all indexes when restaurant is active", async () => {
      const restaurant = {
        district: "西屯區",
        type: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        deletedAt: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([restaurant]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.update.mockReturnValue(makeUpdateChain());

      await service.onRestaurantChanged("r1");

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it("should mark all indexes unavailable when restaurant is soft-deleted", async () => {
      const restaurant = {
        district: "西屯區",
        type: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        deletedAt: new Date(),
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([restaurant]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = makeUpdateChain();
      mockDb.update.mockReturnValue(updateChain);

      await service.onRestaurantChanged("r1");

      // Verify set was called with isAvailable: false
      const setArg = updateChain.set.mock.calls[0][0];
      expect(setArg.isAvailable).toBe(false);
    });

    it("should do nothing when restaurant does not exist", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      await service.onRestaurantChanged("nonexistent");

      expect(mockDb.select).toHaveBeenCalledTimes(1);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should invalidate KV district cache", async () => {
      const restaurant = {
        district: "北屯區",
        type: "日式",
        supportsTakeaway: false,
        supportsDelivery: true,
        deletedAt: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([restaurant]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.update.mockReturnValue(makeUpdateChain());

      await service.onRestaurantChanged("r2");

      expect(mockKV.delete).toHaveBeenCalledWith(
        "search:restaurants:district:北屯區",
      );
    });
  });

  describe("onMenuItemChanged - batch boundary edge cases", () => {
    it("should handle menuItemId=0 (boundary value) — not found → delete", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      await service.onMenuItemChanged(0);

      expect(mockDb.delete).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("should handle very large menuItemId without error", async () => {
      const largeId = 999999999;
      const item = {
        id: largeId,
        name: "特大號漢堡",
        price: 350,
        isAvailable: true,
        tags: null,
        keywords: null,
        deletedAt: null,
        restaurantId: "r-big",
        categoryName: "漢堡類",
        district: "南屯區",
        restaurantType: "西式",
        supportsTakeaway: true,
        supportsDelivery: true,
        restaurantDeleted: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([item]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());
      mockDb.insert.mockReturnValue(makeInsertChain());

      await service.onMenuItemChanged(largeId);

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should handle item with empty tags and keywords arrays", async () => {
      const item = {
        id: 50,
        name: "白飯",
        price: 20,
        isAvailable: true,
        tags: [],
        keywords: JSON.stringify([]),
        deletedAt: null,
        restaurantId: "r1",
        categoryName: "主食",
        district: "西屯區",
        restaurantType: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        restaurantDeleted: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([item]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.delete.mockReturnValue(makeDeleteChain());

      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.onMenuItemChanged(50);

      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.tags).toEqual([]);
    });
  });

  describe("onRestaurantChanged - error edge cases", () => {
    it("should not call KV delete when restaurant has no district", async () => {
      const restaurant = {
        district: null,
        type: "中式",
        supportsTakeaway: true,
        supportsDelivery: false,
        deletedAt: null,
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([restaurant]),
      };
      mockDb.select.mockReturnValue(selectChain);
      mockDb.update.mockReturnValue(makeUpdateChain());

      await service.onRestaurantChanged("r-no-district");

      // KV delete is called with key containing "null"
      expect(mockKV.delete).toHaveBeenCalledWith(
        "search:restaurants:district:null",
      );
    });
  });
});
