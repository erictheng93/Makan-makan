// apps/api/src/features/ingredients/__tests__/IngredientService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IngredientService } from "../services/IngredientService";

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({
          success: true,
          meta: { changes: 1, last_row_id: 1 },
        }),
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
  };
}

describe("IngredientService", () => {
  let service: IngredientService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new IngredientService(mockDb as any);
  });

  // ─── list ─────────────────────────────────────────────────────────

  describe("list", () => {
    it("should return paginated ingredients", async () => {
      const mockRows = [
        {
          id: 1,
          restaurant_id: "r-1",
          name: "Chicken",
          unit: "kg",
          category: "Meat",
          cost_per_unit: 12.5,
          supplier: "Farm Co",
          min_stock_level: 10,
          current_stock: 25,
          is_active: 1,
          deleted_at_ms: null,
        },
        {
          id: 2,
          restaurant_id: "r-1",
          name: "Rice",
          unit: "kg",
          category: "Grain",
          cost_per_unit: 3.0,
          supplier: null,
          min_stock_level: 50,
          current_stock: 100,
          is_active: 1,
          deleted_at_ms: null,
        },
      ];

      // first call: COUNT query via .first()
      // second call: SELECT query via .all()
      const callCount = 0;
      mockDb.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 2 }),
          all: vi.fn().mockResolvedValue({ results: mockRows }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      const result = await service.list("r-1", { page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe("Chicken");
      expect(result.items[0].isActive).toBe(true);
      expect(result.items[1].name).toBe("Rice");
      expect(mockDb.prepare).toHaveBeenCalledTimes(2);
    });

    it("should filter by category", async () => {
      mockDb.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 1 }),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 1,
                restaurant_id: "r-1",
                name: "Chicken",
                unit: "kg",
                category: "Meat",
                cost_per_unit: 12.5,
                supplier: null,
                min_stock_level: null,
                current_stock: null,
                is_active: 1,
                deleted_at_ms: null,
              },
            ],
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      const result = await service.list("r-1", { category: "Meat" });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].category).toBe("Meat");
    });

    it("should filter by search term", async () => {
      mockDb.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({ total: 1 }),
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: 1,
                restaurant_id: "r-1",
                name: "Chicken Breast",
                unit: "kg",
                category: "Meat",
                cost_per_unit: 15,
                supplier: null,
                min_stock_level: null,
                current_stock: null,
                is_active: 1,
                deleted_at_ms: null,
              },
            ],
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }));

      const result = await service.list("r-1", { search: "Chicken" });

      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe("Chicken Breast");
    });
  });

  // ─── get ──────────────────────────────────────────────────────────

  describe("get", () => {
    it("should return a single ingredient", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 1,
            restaurant_id: "r-1",
            name: "Chicken",
            unit: "kg",
            category: "Meat",
            cost_per_unit: 12.5,
            supplier: "Farm Co",
            min_stock_level: 10,
            current_stock: 25,
            is_active: 1,
            deleted_at_ms: null,
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.get("r-1", 1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe("Chicken");
      expect(result!.unit).toBe("kg");
      expect(result!.costPerUnit).toBe(12.5);
      expect(result!.isActive).toBe(true);
    });

    it("should return null for non-existent ingredient", async () => {
      const result = await service.get("r-1", 999);

      expect(result).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────────────────────

  describe("create", () => {
    it("should create an ingredient successfully", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({
            success: true,
            meta: { changes: 1, last_row_id: 5 },
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.create("r-1", {
        name: "Soy Sauce",
        unit: "ml",
        category: "Condiment",
        costPerUnit: 0.05,
        supplier: "Sauce Corp",
        minStockLevel: 500,
        currentStock: 2000,
      });

      expect(result.id).toBe(5);
      expect(result.name).toBe("Soy Sauce");
      expect(result.unit).toBe("ml");
      expect(result.category).toBe("Condiment");
      expect(result.costPerUnit).toBe(0.05);
      expect(result.supplier).toBe("Sauce Corp");
      expect(result.isActive).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  // ─── update ───────────────────────────────────────────────────────

  describe("update", () => {
    it("should update an ingredient", async () => {
      const ingredientRow = {
        id: 1,
        restaurant_id: "r-1",
        name: "Chicken",
        unit: "kg",
        category: "Meat",
        cost_per_unit: 12.5,
        supplier: "Farm Co",
        min_stock_level: 10,
        current_stock: 25,
        is_active: 1,
        deleted_at_ms: null,
      };

      let callCount = 0;
      mockDb.prepare.mockImplementation(() => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(
            // First call (existing check) and third call (re-fetch) return the row
            {
              ...ingredientRow,
              name: callCount++ > 0 ? "Organic Chicken" : "Chicken",
            },
          ),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi
            .fn()
            .mockResolvedValue({ success: true, meta: { changes: 1 } }),
        }),
      }));

      const result = await service.update("r-1", 1, {
        name: "Organic Chicken",
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Organic Chicken");
    });

    it("should return null for non-existent ingredient", async () => {
      // Default mock returns null from .first() — ingredient not found
      const result = await service.update("r-1", 999, { name: "Nope" });

      expect(result).toBeNull();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────

  describe("delete", () => {
    it("should soft delete by setting deleted_at_ms", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({
            success: true,
            meta: { changes: 1 },
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.delete("r-1", 1);

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it("should return false for non-existent ingredient", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({
            success: true,
            meta: { changes: 0 },
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.delete("r-1", 999);

      expect(result).toBe(false);
    });
  });

  // ─── bulkImport ───────────────────────────────────────────────────

  describe("bulkImport", () => {
    it("should import multiple ingredients via db.batch", async () => {
      const ingredients = [
        { name: "Salt", unit: "g" },
        { name: "Pepper", unit: "g" },
        { name: "Oil", unit: "ml" },
      ];

      mockDb.batch.mockResolvedValue([
        { success: true },
        { success: true },
        { success: true },
      ]);

      const result = await service.bulkImport("r-1", ingredients);

      expect(result.imported).toBe(3);
      expect(mockDb.batch).toHaveBeenCalledTimes(1);
      // batch should receive 3 prepared statements
      const batchArgs = mockDb.batch.mock.calls[0][0];
      expect(batchArgs).toHaveLength(3);
    });
  });

  // ─── getCategories ────────────────────────────────────────────────

  describe("getCategories", () => {
    it("should return distinct categories", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              { category: "Condiment" },
              { category: "Grain" },
              { category: "Meat" },
            ],
          }),
          first: vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      const result = await service.getCategories("r-1");

      expect(result).toEqual(["Condiment", "Grain", "Meat"]);
    });
  });

  // ─── updateStock ──────────────────────────────────────────────────

  describe("updateStock", () => {
    it("should update stock quantity", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({
            success: true,
            meta: { changes: 1 },
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.updateStock("r-1", 1, 50);

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });
});
