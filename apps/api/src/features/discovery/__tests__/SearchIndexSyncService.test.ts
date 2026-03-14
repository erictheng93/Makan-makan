import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchIndexSyncService } from "../services/SearchIndexSyncService";

function createMockDb() {
  const boundStatement = {
    run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
  };
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue(boundStatement),
      run: boundStatement.run,
    }),
    _boundStatement: boundStatement,
  };
}

function createMockKV() {
  return {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SearchIndexSyncService", () => {
  let service: SearchIndexSyncService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockKV = createMockKV();
    service = new SearchIndexSyncService(mockDb as any, mockKV as any);
  });

  describe("onMenuItemChanged", () => {
    it("should upsert index when menu item exists and is available", async () => {
      const menuItem = {
        id: 101,
        name: "牛肉麵",
        price: 150,
        is_available: 1,
        tags: JSON.stringify(["牛肉", "麵"]),
        keywords: JSON.stringify(["經典"]),
        deleted_at_ms: null,
        restaurant_id: "r1",
        category_id: "c1",
        category_name: "麵類",
        district: "西屯區",
        restaurant_type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        restaurant_deleted: null,
      };

      // First prepare call = SELECT query → returns menuItem
      const firstBound = {
        first: vi.fn().mockResolvedValue(menuItem),
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
      };
      // Second prepare call = INSERT OR REPLACE → runs
      const secondBound = {
        run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        first: vi.fn(),
        all: vi.fn(),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        const bound = callCount === 1 ? firstBound : secondBound;
        return {
          bind: vi.fn().mockReturnValue(bound),
        };
      });

      await service.onMenuItemChanged(101);

      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      // First call: SELECT query
      expect(mockDb.prepare.mock.calls[0][0]).toContain("SELECT");
      // Second call: INSERT OR REPLACE
      expect(mockDb.prepare.mock.calls[1][0]).toContain("INSERT OR REPLACE");
      expect(secondBound.run).toHaveBeenCalled();
    });

    it("should delete index when menu item does not exist", async () => {
      // First call: SELECT returns null
      const selectBound = {
        first: vi.fn().mockResolvedValue(null),
      };
      // Second call: DELETE
      const deleteBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        const bound = callCount === 1 ? selectBound : deleteBound;
        return {
          bind: vi.fn().mockReturnValue(bound),
        };
      });

      await service.onMenuItemChanged(999);

      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      expect(mockDb.prepare.mock.calls[1][0]).toContain("DELETE");
      expect(deleteBound.run).toHaveBeenCalled();
    });

    it("should set is_available=0 when menu item is soft-deleted", async () => {
      const deletedItem = {
        id: 101,
        name: "牛肉麵",
        price: 150,
        is_available: 1,
        tags: null,
        keywords: null,
        deleted_at_ms: Date.now(), // soft deleted
        restaurant_id: "r1",
        category_id: "c1",
        category_name: "麵類",
        district: "西屯區",
        restaurant_type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        restaurant_deleted: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(deletedItem) };
      const insertBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi.fn((...args: any[]) => {
            if (callCount === 2) {
              // Verify is_available is 0 (7th bind param, index 5)
              expect(args[6]).toBe(0); // is_available = 0 (index 6 in bind params)
            }
            return callCount === 1 ? selectBound : insertBound;
          }),
        };
      });

      await service.onMenuItemChanged(101);
    });

    it("should set is_available=0 when restaurant is soft-deleted", async () => {
      const item = {
        id: 102,
        name: "滷肉飯",
        price: 80,
        is_available: 1,
        tags: null,
        keywords: null,
        deleted_at_ms: null,
        restaurant_id: "r1",
        category_id: "c1",
        category_name: "飯類",
        district: "北屯區",
        restaurant_type: "中式",
        supports_takeaway: 0,
        supports_delivery: 0,
        restaurant_deleted: Date.now(), // restaurant soft deleted
      };

      const selectBound = { first: vi.fn().mockResolvedValue(item) };
      const insertBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi.fn((...args: any[]) => {
            if (callCount === 2) {
              expect(args[6]).toBe(0); // is_available = 0 (index 6 in bind params)
            }
            return callCount === 1 ? selectBound : insertBound;
          }),
        };
      });

      await service.onMenuItemChanged(102);
    });

    it("should merge tags and keywords into combined tags array", async () => {
      const item = {
        id: 103,
        name: "拉麵",
        price: 200,
        is_available: 1,
        tags: JSON.stringify(["日式", "湯麵"]),
        keywords: JSON.stringify(["豚骨", "濃厚"]),
        deleted_at_ms: null,
        restaurant_id: "r2",
        category_id: "c2",
        category_name: "日式",
        district: "南屯區",
        restaurant_type: "日式",
        supports_takeaway: 1,
        supports_delivery: 1,
        restaurant_deleted: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(item) };
      const insertBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let capturedArgs: any[] = [];
      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi.fn((...args: any[]) => {
            if (callCount === 2) capturedArgs = args;
            return callCount === 1 ? selectBound : insertBound;
          }),
        };
      });

      await service.onMenuItemChanged(103);

      // tags param is at index 7 in the bind call (after id, restaurant_id, name, normalized, category_name, price, is_available)
      const tags = JSON.parse(capturedArgs[7]);
      expect(tags).toContain("日式");
      expect(tags).toContain("湯麵");
      expect(tags).toContain("豚骨");
      expect(tags).toContain("濃厚");
      expect(tags).toHaveLength(4);
    });
  });

  describe("onRestaurantChanged", () => {
    it("should update all indexes when restaurant is active", async () => {
      const restaurant = {
        district: "西屯區",
        type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        deleted_at_ms: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(restaurant) };
      const updateBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi
            .fn()
            .mockReturnValue(callCount === 1 ? selectBound : updateBound),
        };
      });

      await service.onRestaurantChanged("r1");

      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
      expect(mockDb.prepare.mock.calls[1][0]).toContain("UPDATE");
      expect(mockDb.prepare.mock.calls[1][0]).toContain("district");
      expect(updateBound.run).toHaveBeenCalled();
    });

    it("should mark all indexes unavailable when restaurant is soft-deleted", async () => {
      const restaurant = {
        district: "西屯區",
        type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        deleted_at_ms: Date.now(),
      };

      const selectBound = { first: vi.fn().mockResolvedValue(restaurant) };
      const updateBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi
            .fn()
            .mockReturnValue(callCount === 1 ? selectBound : updateBound),
        };
      });

      await service.onRestaurantChanged("r1");

      expect(mockDb.prepare.mock.calls[1][0]).toContain("is_available = 0");
      expect(updateBound.run).toHaveBeenCalled();
    });

    it("should do nothing when restaurant does not exist", async () => {
      const selectBound = { first: vi.fn().mockResolvedValue(null) };

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue(selectBound),
      });

      await service.onRestaurantChanged("nonexistent");

      // Only the SELECT query should be called
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it("should invalidate KV district cache", async () => {
      const restaurant = {
        district: "北屯區",
        type: "日式",
        supports_takeaway: 0,
        supports_delivery: 1,
        deleted_at_ms: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(restaurant) };
      const updateBound = {
        run: vi.fn().mockResolvedValue({ success: true }),
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi
            .fn()
            .mockReturnValue(callCount === 1 ? selectBound : updateBound),
        };
      });

      await service.onRestaurantChanged("r2");

      expect(mockKV.delete).toHaveBeenCalledWith(
        "search:restaurants:district:北屯區",
      );
    });
  });

  describe("onMenuItemChanged - batch boundary edge cases", () => {
    it("should handle menuItemId=0 (boundary value) — not found → delete", async () => {
      const selectBound = { first: vi.fn().mockResolvedValue(null) };
      const deleteBound = { run: vi.fn().mockResolvedValue({ success: true }) };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi
            .fn()
            .mockReturnValue(callCount === 1 ? selectBound : deleteBound),
        };
      });

      await service.onMenuItemChanged(0);

      expect(mockDb.prepare.mock.calls[1][0]).toContain("DELETE");
      expect(deleteBound.run).toHaveBeenCalled();
    });

    it("should handle very large menuItemId without error", async () => {
      const largeId = 999999999;
      const item = {
        id: largeId,
        name: "特大號漢堡",
        price: 350,
        is_available: 1,
        tags: null,
        keywords: null,
        deleted_at_ms: null,
        restaurant_id: "r-big",
        category_id: "c1",
        category_name: "漢堡類",
        district: "南屯區",
        restaurant_type: "西式",
        supports_takeaway: 1,
        supports_delivery: 1,
        restaurant_deleted: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(item) };
      const insertBound = { run: vi.fn().mockResolvedValue({ success: true }) };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi
            .fn()
            .mockReturnValue(callCount === 1 ? selectBound : insertBound),
        };
      });

      await service.onMenuItemChanged(largeId);

      expect(insertBound.run).toHaveBeenCalled();
    });

    it("should handle item with empty tags and keywords arrays", async () => {
      const item = {
        id: 50,
        name: "白飯",
        price: 20,
        is_available: 1,
        tags: JSON.stringify([]),
        keywords: JSON.stringify([]),
        deleted_at_ms: null,
        restaurant_id: "r1",
        category_id: "c1",
        category_name: "主食",
        district: "西屯區",
        restaurant_type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        restaurant_deleted: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(item) };
      const insertBound = { run: vi.fn().mockResolvedValue({ success: true }) };

      let callCount = 0;
      let capturedArgs: any[] = [];
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi.fn((...args: any[]) => {
            if (callCount === 2) capturedArgs = args;
            return callCount === 1 ? selectBound : insertBound;
          }),
        };
      });

      await service.onMenuItemChanged(50);

      // tags at index 7 should be an empty JSON array
      expect(JSON.parse(capturedArgs[7])).toEqual([]);
    });
  });

  describe("onRestaurantChanged - error edge cases", () => {
    it("should not call KV delete when restaurant has no district", async () => {
      const restaurant = {
        district: null,
        type: "中式",
        supports_takeaway: 1,
        supports_delivery: 0,
        deleted_at_ms: null,
      };

      const selectBound = { first: vi.fn().mockResolvedValue(restaurant) };
      const updateBound = { run: vi.fn().mockResolvedValue({ success: true }) };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        return {
          bind: vi
            .fn()
            .mockReturnValue(callCount === 1 ? selectBound : updateBound),
        };
      });

      await service.onRestaurantChanged("r-no-district");

      // KV delete is called with key containing "null"
      expect(mockKV.delete).toHaveBeenCalledWith(
        "search:restaurants:district:null",
      );
    });
  });
});
