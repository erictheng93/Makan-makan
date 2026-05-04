// apps/api/src/features/ingredients/__tests__/IngredientService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IngredientService } from "../services/IngredientService";

// ─── Mock Drizzle ──────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  selectDistinct: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  like: vi.fn(),
  isNull: vi.fn(),
  sql: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@makanmasak/database", () => ({
  ingredientDefinitions: { name: "name", category: "category" },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeSelectChain(returnValue: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(returnValue),
  };
}

function makeCountSelectChain(total: number) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ total }]),
  };
}

function makeInsertChain(returnValue: unknown) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returnValue),
  };
}

function makeUpdateChain(changes: number = 1) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({ meta: { changes } }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("IngredientService", () => {
  let service: IngredientService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IngredientService({} as never);
  });

  // ─── list ─────────────────────────────────────────────────────────

  describe("list", () => {
    it("should return paginated ingredients", async () => {
      const mockRows = [
        {
          id: 1,
          restaurantId: "r-1",
          name: "Chicken",
          unit: "kg",
          category: "Meat",
          costPerUnit: 12.5,
          supplier: "Farm Co",
          minStockLevel: 10,
          currentStock: 25,
          isActive: true,
          deletedAt: null,
        },
        {
          id: 2,
          restaurantId: "r-1",
          name: "Rice",
          unit: "kg",
          category: "Grain",
          costPerUnit: 3.0,
          supplier: null,
          minStockLevel: 50,
          currentStock: 100,
          isActive: true,
          deletedAt: null,
        },
      ];

      // First call: count query
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeCountSelectChain(2);
        }
        return makeSelectChain(mockRows);
      });

      const result = await service.list("r-1", { page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe("Chicken");
      expect(result.items[0].isActive).toBe(true);
      expect(result.items[1].name).toBe("Rice");
      expect(mockDb.select).toHaveBeenCalledTimes(2);
    });

    it("should filter by category", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeCountSelectChain(1);
        }
        return makeSelectChain([
          {
            id: 1,
            restaurantId: "r-1",
            name: "Chicken",
            unit: "kg",
            category: "Meat",
            costPerUnit: 12.5,
            supplier: null,
            minStockLevel: null,
            currentStock: null,
            isActive: true,
            deletedAt: null,
          },
        ]);
      });

      const result = await service.list("r-1", { category: "Meat" });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].category).toBe("Meat");
    });

    it("should filter by search term", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return makeCountSelectChain(1);
        }
        return makeSelectChain([
          {
            id: 1,
            restaurantId: "r-1",
            name: "Chicken Breast",
            unit: "kg",
            category: "Meat",
            costPerUnit: 15,
            supplier: null,
            minStockLevel: null,
            currentStock: null,
            isActive: true,
            deletedAt: null,
          },
        ]);
      });

      const result = await service.list("r-1", { search: "Chicken" });

      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe("Chicken Breast");
    });
  });

  // ─── get ──────────────────────────────────────────────────────────

  describe("get", () => {
    it("should return a single ingredient", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: 1,
            restaurantId: "r-1",
            name: "Chicken",
            unit: "kg",
            category: "Meat",
            costPerUnit: 12.5,
            supplier: "Farm Co",
            minStockLevel: 10,
            currentStock: 25,
            isActive: true,
            deletedAt: null,
          },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.get("r-1", 1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(1);
      expect(result!.name).toBe("Chicken");
      expect(result!.unit).toBe("kg");
      expect(result!.costPerUnit).toBe(12.5);
      expect(result!.isActive).toBe(true);
    });

    it("should return null for non-existent ingredient", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      const result = await service.get("r-1", 999);

      expect(result).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────────────────────

  describe("create", () => {
    it("should create an ingredient successfully", async () => {
      const insertChain = makeInsertChain([
        {
          id: 5,
          restaurantId: "r-1",
          name: "Soy Sauce",
          unit: "ml",
          category: "Condiment",
          costPerUnit: 0.05,
          supplier: "Sauce Corp",
          minStockLevel: 500,
          currentStock: 2000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);
      mockDb.insert.mockReturnValue(insertChain);

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
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  // ─── update ───────────────────────────────────────────────────────

  describe("update", () => {
    it("should update an ingredient", async () => {
      let callCount = 0;
      mockDb.select.mockImplementation(() => {
        callCount++;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([
            {
              id: 1,
              restaurantId: "r-1",
              name: callCount > 1 ? "Organic Chicken" : "Chicken",
              unit: "kg",
              category: "Meat",
              costPerUnit: 12.5,
              supplier: "Farm Co",
              minStockLevel: 10,
              currentStock: 25,
              isActive: true,
              deletedAt: null,
            },
          ]),
        };
      });

      mockDb.update.mockReturnValue(makeUpdateChain());

      const result = await service.update("r-1", 1, {
        name: "Organic Chicken",
      });

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Organic Chicken");
    });

    it("should return null for non-existent ingredient", async () => {
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      });

      const result = await service.update("r-1", 999, { name: "Nope" });

      expect(result).toBeNull();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────

  describe("delete", () => {
    it("should soft delete by setting deleted_at_ms", async () => {
      mockDb.update.mockReturnValue(makeUpdateChain(1));

      const result = await service.delete("r-1", 1);

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should return false for non-existent ingredient", async () => {
      mockDb.update.mockReturnValue(makeUpdateChain(0));

      const result = await service.delete("r-1", 999);

      expect(result).toBe(false);
    });
  });

  // ─── bulkImport ───────────────────────────────────────────────────

  describe("bulkImport", () => {
    it("should import multiple ingredients via Drizzle multi-row insert", async () => {
      const ingredients = [
        { name: "Salt", unit: "g" },
        { name: "Pepper", unit: "g" },
        { name: "Oil", unit: "ml" },
      ];

      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service.bulkImport("r-1", ingredients);

      expect(result.imported).toBe(3);
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
      expect(insertChain.values).toHaveBeenCalledTimes(1);
      // Should pass an array of 3 items
      const valuesArg = insertChain.values.mock.calls[0][0];
      expect(valuesArg).toHaveLength(3);
    });
  });

  // ─── getCategories ────────────────────────────────────────────────

  describe("getCategories", () => {
    it("should return distinct categories", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockResolvedValue([
            { category: "Condiment" },
            { category: "Grain" },
            { category: "Meat" },
          ]),
      };
      mockDb.selectDistinct.mockReturnValue(chain);

      const result = await service.getCategories("r-1");

      expect(result).toEqual(["Condiment", "Grain", "Meat"]);
    });
  });

  // ─── updateStock ──────────────────────────────────────────────────

  describe("updateStock", () => {
    it("should update stock quantity", async () => {
      mockDb.update.mockReturnValue(makeUpdateChain(1));

      const result = await service.updateStock("r-1", 1, 50);

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
