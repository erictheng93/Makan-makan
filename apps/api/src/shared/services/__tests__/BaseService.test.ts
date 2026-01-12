/**
 * BaseService Tests
 *
 * Tests for the abstract BaseService class
 * Uses a concrete TestService implementation for testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BaseService } from "../BaseService";

// Mock the database module
vi.mock("@makanmakan/database", () => ({
  getCurrentTimestamp: vi.fn(() => "2024-01-01T00:00:00Z"),
}));

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn(() => "test-uuid-12345");
vi.stubGlobal("crypto", { randomUUID: mockRandomUUID });

// Concrete implementation for testing abstract BaseService
class TestService extends BaseService {
  constructor(db: any) {
    super(db);
  }

  // Expose protected methods for testing
  public testTransaction<T>(operations: () => Promise<T>): Promise<T> {
    return this.transaction(operations);
  }

  public testBuildPaginationQuery(
    baseQuery: string,
    params: any[],
    page?: number,
    limit?: number,
  ) {
    return this.buildPaginationQuery(baseQuery, params, page, limit);
  }

  public testBuildDateRangeFilter(
    dateField: string,
    startDate?: string,
    endDate?: string,
  ) {
    return this.buildDateRangeFilter(dateField, startDate, endDate);
  }

  public testGenerateId() {
    return this.generateId();
  }

  public testCreateResponse<T>(success: boolean, data?: T, error?: string) {
    return this.createResponse(success, data, error);
  }

  public testParseJsonField(jsonString: string, defaultValue?: any) {
    return this.parseJsonField(jsonString, defaultValue);
  }

  public testFormatNumber(value: any, defaultValue?: number) {
    return this.formatNumber(value, defaultValue);
  }

  public async testCreateAuditLog(data: {
    action: string;
    entityType: string;
    entityId: string;
    userId: number;
    description?: string;
    oldData?: any;
    newData?: any;
  }) {
    return this.createAuditLog(data);
  }

  // Expose d1 for testing
  public getDb() {
    return this.d1;
  }
}

describe("BaseService", () => {
  let testService: TestService;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    };

    testService = new TestService(mockDb);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Constructor", () => {
    it("should initialize with database instance", () => {
      expect(testService.getDb()).toBe(mockDb);
    });

    it("should accept any database implementation", () => {
      const customDb = { custom: true };
      const service = new TestService(customDb);
      expect(service.getDb()).toBe(customDb);
    });
  });

  describe("transaction", () => {
    it("should execute operations and return result", async () => {
      const mockResult = { id: 1, name: "test" };
      const operations = vi.fn().mockResolvedValue(mockResult);

      const result = await testService.testTransaction(operations);

      expect(operations).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it("should propagate errors from operations", async () => {
      const operations = vi
        .fn()
        .mockRejectedValue(new Error("Transaction failed"));

      await expect(testService.testTransaction(operations)).rejects.toThrow(
        "Transaction failed",
      );
    });

    it("should handle async operations correctly", async () => {
      const operations = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      };

      const result = await testService.testTransaction(operations);
      expect(result).toBe("async result");
    });
  });

  describe("buildPaginationQuery", () => {
    it("should build pagination query with default values", () => {
      const result = testService.testBuildPaginationQuery(
        "SELECT * FROM users",
        [],
      );

      expect(result.query).toBe("SELECT * FROM users LIMIT ? OFFSET ?");
      expect(result.params).toEqual([20, 0]); // Default limit 20, page 1 = offset 0
    });

    it("should build pagination query with custom page and limit", () => {
      const result = testService.testBuildPaginationQuery(
        "SELECT * FROM users",
        [],
        2,
        10,
      );

      expect(result.query).toBe("SELECT * FROM users LIMIT ? OFFSET ?");
      expect(result.params).toEqual([10, 10]); // Page 2 with limit 10 = offset 10
    });

    it("should preserve existing params", () => {
      const result = testService.testBuildPaginationQuery(
        "SELECT * FROM users WHERE status = ?",
        ["active"],
        3,
        15,
      );

      expect(result.query).toBe(
        "SELECT * FROM users WHERE status = ? LIMIT ? OFFSET ?",
      );
      expect(result.params).toEqual(["active", 15, 30]); // Page 3 with limit 15 = offset 30
    });

    it("should calculate offset correctly for various pages", () => {
      // Page 1, limit 20 = offset 0
      expect(
        testService.testBuildPaginationQuery("SELECT *", [], 1, 20).params,
      ).toEqual([20, 0]);

      // Page 5, limit 10 = offset 40
      expect(
        testService.testBuildPaginationQuery("SELECT *", [], 5, 10).params,
      ).toEqual([10, 40]);

      // Page 10, limit 50 = offset 450
      expect(
        testService.testBuildPaginationQuery("SELECT *", [], 10, 50).params,
      ).toEqual([50, 450]);
    });
  });

  describe("buildDateRangeFilter", () => {
    it("should return empty filter when no dates provided", () => {
      const result = testService.testBuildDateRangeFilter("created_at");

      expect(result.filter).toBe("");
      expect(result.params).toEqual([]);
    });

    it("should build filter with start date only", () => {
      const result = testService.testBuildDateRangeFilter(
        "created_at",
        "2024-01-01",
      );

      expect(result.filter).toBe(" AND DATE(created_at) >= ?");
      expect(result.params).toEqual(["2024-01-01"]);
    });

    it("should build filter with end date only", () => {
      const result = testService.testBuildDateRangeFilter(
        "created_at",
        undefined,
        "2024-12-31",
      );

      expect(result.filter).toBe(" AND DATE(created_at) <= ?");
      expect(result.params).toEqual(["2024-12-31"]);
    });

    it("should build filter with both start and end dates", () => {
      const result = testService.testBuildDateRangeFilter(
        "created_at",
        "2024-01-01",
        "2024-12-31",
      );

      expect(result.filter).toBe(
        " AND DATE(created_at) >= ? AND DATE(created_at) <= ?",
      );
      expect(result.params).toEqual(["2024-01-01", "2024-12-31"]);
    });

    it("should work with different date field names", () => {
      const result = testService.testBuildDateRangeFilter(
        "updated_at",
        "2024-06-01",
        "2024-06-30",
      );

      expect(result.filter).toContain("DATE(updated_at)");
    });
  });

  describe("generateId", () => {
    it("should generate UUID using crypto.randomUUID", () => {
      const id = testService.testGenerateId();

      expect(id).toBe("test-uuid-12345");
      expect(mockRandomUUID).toHaveBeenCalled();
    });

    it("should generate unique IDs on each call", () => {
      mockRandomUUID
        .mockReturnValueOnce("uuid-1")
        .mockReturnValueOnce("uuid-2")
        .mockReturnValueOnce("uuid-3");

      const id1 = testService.testGenerateId();
      const id2 = testService.testGenerateId();
      const id3 = testService.testGenerateId();

      expect(id1).toBe("uuid-1");
      expect(id2).toBe("uuid-2");
      expect(id3).toBe("uuid-3");
    });
  });

  describe("createResponse", () => {
    it("should create success response with data", () => {
      const data = { id: 1, name: "test" };
      const result = testService.testCreateResponse(true, data);

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: "test" },
      });
    });

    it("should create success response without data", () => {
      const result = testService.testCreateResponse(true);

      expect(result).toEqual({
        success: true,
        data: undefined,
      });
    });

    it("should create error response", () => {
      const result = testService.testCreateResponse(
        false,
        undefined,
        "Error message",
      );

      expect(result).toEqual({
        success: false,
        error: "Error message",
      });
    });

    it("should not include data in error response", () => {
      const result = testService.testCreateResponse(
        false,
        { ignored: true },
        "Error",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Error");
      expect(result.data).toBeUndefined();
    });

    it("should handle various data types", () => {
      // Array
      expect(testService.testCreateResponse(true, [1, 2, 3]).data).toEqual([
        1, 2, 3,
      ]);

      // String
      expect(testService.testCreateResponse(true, "string data").data).toBe(
        "string data",
      );

      // Number
      expect(testService.testCreateResponse(true, 42).data).toBe(42);

      // Null
      expect(testService.testCreateResponse(true, null).data).toBeNull();
    });
  });

  describe("parseJsonField", () => {
    it("should parse valid JSON string", () => {
      const result = testService.testParseJsonField(
        '{"name":"test","value":123}',
      );

      expect(result).toEqual({ name: "test", value: 123 });
    });

    it("should parse JSON array", () => {
      const result = testService.testParseJsonField("[1,2,3]");

      expect(result).toEqual([1, 2, 3]);
    });

    it("should return default value for invalid JSON", () => {
      const result = testService.testParseJsonField("invalid json");

      expect(result).toEqual({});
    });

    it("should return custom default value for invalid JSON", () => {
      const defaultValue = { fallback: true };
      const result = testService.testParseJsonField("invalid", defaultValue);

      expect(result).toEqual({ fallback: true });
    });

    it("should handle empty string", () => {
      const result = testService.testParseJsonField("");

      expect(result).toEqual({});
    });

    it("should handle null-like strings", () => {
      const result = testService.testParseJsonField("null");

      expect(result).toBeNull();
    });

    it("should handle numeric strings", () => {
      const result = testService.testParseJsonField("123");

      expect(result).toBe(123);
    });

    it("should handle boolean strings", () => {
      expect(testService.testParseJsonField("true")).toBe(true);
      expect(testService.testParseJsonField("false")).toBe(false);
    });

    it("should return default for undefined-like input", () => {
      // Empty string coalesces to '{}'
      const result = testService.testParseJsonField("");
      expect(result).toEqual({});
    });
  });

  describe("formatNumber", () => {
    it("should format valid number string", () => {
      expect(testService.testFormatNumber("123")).toBe(123);
      expect(testService.testFormatNumber("45.67")).toBe(45.67);
    });

    it("should format number", () => {
      expect(testService.testFormatNumber(100)).toBe(100);
      expect(testService.testFormatNumber(3.14)).toBe(3.14);
    });

    it("should return default for NaN", () => {
      expect(testService.testFormatNumber("not a number")).toBe(0);
      expect(testService.testFormatNumber(NaN)).toBe(0);
    });

    it("should return custom default for NaN", () => {
      expect(testService.testFormatNumber("invalid", 99)).toBe(99);
      expect(testService.testFormatNumber(undefined, -1)).toBe(-1);
    });

    it("should handle edge cases", () => {
      expect(testService.testFormatNumber("0")).toBe(0);
      expect(testService.testFormatNumber("-5")).toBe(-5);
      expect(testService.testFormatNumber("1e10")).toBe(10000000000);
    });

    it("should handle null and undefined", () => {
      expect(testService.testFormatNumber(null)).toBe(0);
      expect(testService.testFormatNumber(undefined)).toBe(0);
    });

    it("should handle empty string", () => {
      expect(testService.testFormatNumber("")).toBe(0);
    });

    it("should handle Infinity", () => {
      expect(testService.testFormatNumber(Infinity)).toBe(Infinity);
      expect(testService.testFormatNumber(-Infinity)).toBe(-Infinity);
    });
  });

  describe("createAuditLog", () => {
    it("should create audit log with required fields", async () => {
      await testService.testCreateAuditLog({
        action: "CREATE",
        entityType: "user",
        entityId: "123",
        userId: 1,
      });

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO audit_logs"),
      );
    });

    it("should create audit log with all fields", async () => {
      const bindMock = vi
        .fn()
        .mockReturnValue({ run: vi.fn().mockResolvedValue({ success: true }) });
      mockDb.prepare.mockReturnValue({ bind: bindMock });

      await testService.testCreateAuditLog({
        action: "UPDATE",
        entityType: "order",
        entityId: "456",
        userId: 2,
        description: "Updated order status",
        oldData: { status: "pending" },
        newData: { status: "completed" },
      });

      expect(bindMock).toHaveBeenCalledWith(
        "test-uuid-12345",
        "UPDATE",
        "order",
        "456",
        2,
        "Updated order status",
        '{"status":"pending"}',
        '{"status":"completed"}',
        "2024-01-01T00:00:00Z",
      );
    });

    it("should handle null optional fields", async () => {
      const bindMock = vi
        .fn()
        .mockReturnValue({ run: vi.fn().mockResolvedValue({ success: true }) });
      mockDb.prepare.mockReturnValue({ bind: bindMock });

      await testService.testCreateAuditLog({
        action: "DELETE",
        entityType: "item",
        entityId: "789",
        userId: 3,
      });

      expect(bindMock).toHaveBeenCalledWith(
        "test-uuid-12345",
        "DELETE",
        "item",
        "789",
        3,
        null,
        null,
        null,
        "2024-01-01T00:00:00Z",
      );
    });

    it("should not throw error on database failure", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDb.prepare.mockImplementation(() => {
        throw new Error("Database error");
      });

      // Should not throw
      await expect(
        testService.testCreateAuditLog({
          action: "CREATE",
          entityType: "test",
          entityId: "1",
          userId: 1,
        }),
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "創建審計日誌失敗:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should log error message when audit log creation fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error("Insert failed")),
        }),
      });

      await testService.testCreateAuditLog({
        action: "TEST",
        entityType: "test",
        entityId: "1",
        userId: 1,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "創建審計日誌失敗:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });
});
