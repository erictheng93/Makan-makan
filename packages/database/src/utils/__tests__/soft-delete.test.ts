import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  notDeleted,
  isDeleted,
  SoftDeleteService,
  createSoftDeleteService,
  withSoftDelete,
} from "../soft-delete";

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => ({
    _type: "sql",
    strings,
    values,
  }),
  isNull: (col: any) => ({ _type: "isNull", column: col }),
  lte: (col: any, val: any) => ({ _type: "lte", column: col, value: val }),
  and: (...conditions: any[]) => ({ _type: "and", conditions }),
}));

// Create mock DB that returns chainable query builders
function createMockDb() {
  const setResult = { where: vi.fn().mockResolvedValue(undefined) };
  const updateResult = { set: vi.fn().mockReturnValue(setResult) };
  const deleteResult = { where: vi.fn().mockResolvedValue(undefined) };
  const selectResult = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: 5 }]),
    }),
  };

  return {
    update: vi.fn().mockReturnValue(updateResult),
    delete: vi.fn().mockReturnValue(deleteResult),
    select: vi.fn().mockReturnValue(selectResult),
    _mocks: { updateResult, setResult, deleteResult, selectResult },
  } as any;
}

const mockTable = { deletedAt: { name: "deleted_at" } } as any;

describe("soft-delete", () => {
  describe("notDeleted", () => {
    it("should return an isNull SQL condition", () => {
      const result = notDeleted(mockTable.deletedAt);
      expect(result).toEqual(expect.objectContaining({ _type: "isNull" }));
    });
  });

  describe("isDeleted", () => {
    it("should return a SQL condition for NOT NULL", () => {
      const result = isDeleted(mockTable.deletedAt);
      expect(result).toBeDefined();
    });
  });

  describe("SoftDeleteService", () => {
    let db: ReturnType<typeof createMockDb>;
    let service: SoftDeleteService;

    beforeEach(() => {
      vi.clearAllMocks();
      db = createMockDb();
      service = new SoftDeleteService(db, { retentionDays: 90 });
    });

    describe("softDelete", () => {
      it("should update table setting deletedAt to current time", async () => {
        const mockCondition = { _type: "eq" } as any;

        await service.softDelete(mockTable, mockCondition);

        expect(db.update).toHaveBeenCalledWith(mockTable);
        expect(db._mocks.updateResult.set).toHaveBeenCalledWith(
          expect.objectContaining({ deletedAt: expect.any(Number) }),
        );
        expect(db._mocks.setResult.where).toHaveBeenCalledWith(mockCondition);
      });

      it("should use unix seconds (not milliseconds) for deletedAt", async () => {
        const beforeSeconds = Math.floor(Date.now() / 1000);
        await service.softDelete(mockTable, {} as any);
        const afterSeconds = Math.floor(Date.now() / 1000);

        const setArg = db._mocks.updateResult.set.mock.calls[0][0];
        expect(setArg.deletedAt).toBeGreaterThanOrEqual(beforeSeconds);
        expect(setArg.deletedAt).toBeLessThanOrEqual(afterSeconds);
      });
    });

    describe("restore", () => {
      it("should set deletedAt to null", async () => {
        const mockCondition = { _type: "eq" } as any;

        await service.restore(mockTable, mockCondition);

        expect(db.update).toHaveBeenCalledWith(mockTable);
        expect(db._mocks.updateResult.set).toHaveBeenCalledWith({
          deletedAt: null,
        });
        expect(db._mocks.setResult.where).toHaveBeenCalledWith(mockCondition);
      });
    });

    describe("purgeExpired", () => {
      it("should delete records older than retention period", async () => {
        await service.purgeExpired(mockTable, mockTable.deletedAt);

        expect(db.delete).toHaveBeenCalledWith(mockTable);
        expect(db._mocks.deleteResult.where).toHaveBeenCalledWith(
          expect.objectContaining({ _type: "and" }),
        );
      });

      it("should accept custom retention days", async () => {
        await service.purgeExpired(mockTable, mockTable.deletedAt, 30);

        expect(db.delete).toHaveBeenCalledWith(mockTable);
      });
    });

    describe("countDeleted", () => {
      it("should return count of soft-deleted records", async () => {
        const result = await service.countDeleted(
          mockTable,
          mockTable.deletedAt,
        );

        expect(result).toBe(5);
        expect(db.select).toHaveBeenCalled();
      });

      it("should return 0 when no deleted records", async () => {
        db.select.mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        });

        const result = await service.countDeleted(
          mockTable,
          mockTable.deletedAt,
        );

        expect(result).toBe(0);
      });
    });

    describe("countExpired", () => {
      it("should return count of expired soft-deleted records", async () => {
        const result = await service.countExpired(
          mockTable,
          mockTable.deletedAt,
        );

        expect(result).toBe(5);
      });

      it("should use custom retention days", async () => {
        await service.countExpired(mockTable, mockTable.deletedAt, 30);

        expect(db.select).toHaveBeenCalled();
      });
    });
  });

  describe("createSoftDeleteService", () => {
    it("should create a SoftDeleteService instance", () => {
      const db = createMockDb();
      const service = createSoftDeleteService(db);
      expect(service).toBeInstanceOf(SoftDeleteService);
    });
  });

  describe("withSoftDelete", () => {
    it("should return active filter", () => {
      const filter = withSoftDelete(mockTable.deletedAt);
      const activeCondition = filter.active();
      expect(activeCondition).toBeDefined();
    });

    it("should return deleted filter", () => {
      const filter = withSoftDelete(mockTable.deletedAt);
      const deletedCondition = filter.deleted();
      expect(deletedCondition).toBeDefined();
    });

    it("should return all filter (1=1)", () => {
      const filter = withSoftDelete(mockTable.deletedAt);
      const allCondition = filter.all();
      expect(allCondition).toBeDefined();
    });
  });
});
