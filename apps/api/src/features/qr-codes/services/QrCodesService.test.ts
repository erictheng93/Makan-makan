import { beforeEach, describe, expect, it, vi } from "vitest";

type PreparedResult = {
  first?: unknown;
  all?: unknown[];
};

const mocks = vi.hoisted(() => {
  const qrService = {
    generateQRCode: vi.fn(),
    createAuditLog: vi.fn(),
    generateBulkQRCodes: vi.fn(),
    getQRCode: vi.fn(),
    recordDownload: vi.fn(),
    getBatchStatus: vi.fn(),
    getQRCodeStats: vi.fn(),
    getActiveTemplates: vi.fn(),
    getTemplate: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
  };
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  };

  return { qrService, cache };
});

vi.mock("../../../core/database", () => ({
  getDatabaseConnection: vi.fn(() => ({})),
}));

vi.mock("../../../core/cache", () => ({
  KVCacheService: vi.fn(function KVCacheService() {
    return mocks.cache;
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  }),
  SimplePerformanceTracker: vi.fn(function SimplePerformanceTracker() {
    return {
      startTimer: vi.fn(() => "timer"),
      endTimer: vi.fn(() => 12),
      recordMetric: vi.fn(),
    };
  }),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    QRCodeService: vi.fn(function QRCodeService() {
      return mocks.qrService;
    }),
  };
});

vi.mock("qrcode", () => ({
  default: {
    toBuffer: vi.fn(async () => Buffer.from("png")),
    toString: vi.fn(async () => "<svg />"),
  },
  toBuffer: vi.fn(async () => Buffer.from("png")),
  toString: vi.fn(async () => "<svg />"),
}));

import { QrCodesService } from "./QrCodesService";

function createPreparedDb(results: PreparedResult[] = []) {
  const statements: Array<{
    sql: string;
    bind: ReturnType<typeof vi.fn>;
    first: ReturnType<typeof vi.fn>;
    all: ReturnType<typeof vi.fn>;
  }> = [];

  const db = {
    prepare: vi.fn((sql: string) => {
      const result = results.shift() ?? {};
      const statement = {
        sql,
        bind: vi.fn(() => statement),
        first: vi.fn(async () => result.first ?? null),
        all: vi.fn(async () => ({ results: result.all ?? [] })),
      };

      statements.push(statement);
      return statement;
    }),
  };

  return { db: db as unknown as D1Database, statements };
}

function createService(
  env: Partial<{ DB: D1Database; CACHE_KV: KVNamespace }> = {},
) {
  return new QrCodesService({
    DB: env.DB ?? ({} as D1Database),
    CACHE_KV: env.CACHE_KV ?? ({} as KVNamespace),
  } as any);
}

describe("QrCodesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
  });

  it("generates QR codes with creator metadata and audit logging", async () => {
    mocks.qrService.generateQRCode.mockResolvedValue({
      id: "42",
      url: "https://cdn.example.test/qr/42.png",
      createdAt: "2026-06-07T00:00:00.000Z",
    });

    const result = await createService().generateQR(
      { content: "table-1", format: "png" },
      7,
      "restaurant-1",
    );

    expect(mocks.qrService.generateQRCode).toHaveBeenCalledWith({
      content: "table-1",
      format: "png",
      style: undefined,
      metadata: { createdBy: "7" },
      restaurantId: "restaurant-1",
      createdBy: 7,
    });
    expect(mocks.qrService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        action: "QR_GENERATED",
      }),
    );
    expect(result).toMatchObject({
      id: 42,
      content: "table-1",
      format: "png",
      downloadUrl: "https://cdn.example.test/qr/42.png",
      restaurantId: "restaurant-1",
      userId: 7,
    });
  });

  it("fails deterministic QR entity ID mapping without Math.random fallbacks", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for QR entity IDs");
    });
    mocks.qrService.generateQRCode.mockResolvedValue({
      url: "https://cdn.example.test/qr/missing.png",
      createdAt: "2026-06-07T00:00:00.000Z",
    });

    await expect(
      createService().generateQR(
        { content: "table-1", format: "png" },
        7,
        "restaurant-1",
      ),
    ).rejects.toThrow("QR code generation did not return an ID");
    expect(randomSpy).not.toHaveBeenCalled();
  });

  it("generates bulk QR batches and rejects missing owner context", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random should not be used for QR batch IDs");
    });
    mocks.qrService.generateBulkQRCodes.mockResolvedValue({
      id: 314,
      batchId: "batch-1",
    });

    await expect(
      createService().generateBulkQR(
        {
          tables: [{ id: 1, name: "A1", content: "table-1" }],
          format: "zip",
          includeMetadata: true,
        },
        7,
        "restaurant-1",
      ),
    ).resolves.toMatchObject({
      id: 314,
      batchId: "batch-1",
      itemCount: 1,
      status: "completed",
      progress: 100,
    });
    expect(randomSpy).not.toHaveBeenCalled();
    expect(mocks.qrService.generateBulkQRCodes).toHaveBeenCalledWith(
      "restaurant-1",
      [1],
      7,
    );

    await expect(
      createService().generateBulkQR({
        tables: [{ id: 1, name: "A1", content: "table-1" }],
      } as any),
    ).rejects.toThrow("Restaurant ID and User ID are required");
  });

  it("downloads single QR artifacts and records download counts", async () => {
    mocks.qrService.getQRCode.mockResolvedValue({
      id: "42",
      content: "table-1",
      format: "png",
      restaurantId: "restaurant-1",
      styleJson: JSON.stringify({ size: 256, foregroundColor: "#111111" }),
    });

    const result = await createService().downloadQR(42, {
      userRole: 1,
      userRestaurantId: "restaurant-1",
    } as any);

    expect(mocks.qrService.recordDownload).toHaveBeenCalledWith("42", "png");
    expect(result).toMatchObject({
      data: Buffer.from("png"),
      contentType: "image/png",
      filename: "qr-code-42.png",
    });

    mocks.qrService.getQRCode.mockResolvedValueOnce(null);
    await expect(createService().downloadQR(404)).resolves.toBeNull();
  });

  it("rejects cross-tenant QR downloads before recording the download", async () => {
    mocks.qrService.getQRCode.mockResolvedValue({
      id: "42",
      content: "table-1",
      format: "png",
      restaurantId: "restaurant-2",
    });

    await expect(
      (createService() as any).downloadQR(42, {
        userRole: 1,
        userRestaurantId: "restaurant-1",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    expect(mocks.qrService.recordDownload).not.toHaveBeenCalled();
  });

  it("downloads batch archives with manifest and generated SVG entries", async () => {
    mocks.qrService.getBatchStatus.mockResolvedValue({
      totalCodes: 2,
      restaurantId: "restaurant-1",
    });

    const result = await createService().downloadBatch("batch-1", {
      userRole: 1,
      userRestaurantId: "restaurant-1",
    } as any);

    expect(result).toMatchObject({
      contentType: "application/zip",
      filename: "qr-batch-batch-1.zip",
    });
    expect(result?.data.length).toBeGreaterThan(0);

    mocks.qrService.getBatchStatus.mockResolvedValueOnce(null);
    await expect(createService().downloadBatch("missing")).resolves.toBeNull();
  });

  it("rejects cross-tenant batch downloads", async () => {
    mocks.qrService.getBatchStatus.mockResolvedValue({
      totalCodes: 2,
      restaurantId: "restaurant-2",
    });

    await expect(
      (createService() as any).downloadBatch("batch-1", {
        userRole: 1,
        userRestaurantId: "restaurant-1",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("uses cached statistics and transforms uncached stats", async () => {
    mocks.cache.get.mockResolvedValueOnce({ totalQRCodes: 99 });

    await expect(
      createService().getStatistics("restaurant-1"),
    ).resolves.toEqual({
      totalQRCodes: 99,
    });

    mocks.cache.get.mockResolvedValueOnce(null);
    mocks.qrService.getQRCodeStats.mockResolvedValue({
      totalCodes: 2,
      totalDownloads: 5,
      popularTemplates: [{ id: 1, name: "Classic", usageCount: 3 }],
    });

    await expect(createService().getStatistics()).resolves.toMatchObject({
      totalQRCodes: 2,
      totalDownloads: 5,
      popularTemplates: [{ id: 1, name: "Classic", usage_count: 3 }],
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "qr-stats:global",
      expect.objectContaining({ totalQRCodes: 2 }),
      expect.any(Number),
    );
  });

  it("filters uncached statistics by restaurant", async () => {
    mocks.cache.get.mockResolvedValueOnce(null);
    const { db, statements } = createPreparedDb([
      { first: { count: 2 } },
      { first: { count: 5 } },
      { first: { count: 1 } },
      { all: [{ id: 10, name: "Modern", usage_count: 3 }] },
    ]);

    await expect(
      createService({ DB: db }).getStatistics("restaurant-1"),
    ).resolves.toMatchObject({
      totalQRCodes: 2,
      totalDownloads: 5,
      totalTemplates: 1,
      popularTemplates: [{ id: 10, name: "Modern", usage_count: 3 }],
    });

    expect(mocks.qrService.getQRCodeStats).not.toHaveBeenCalled();
    expect(statements).toHaveLength(4);
    expect(
      statements.every((statement) => statement.sql.includes("restaurant_id")),
    ).toBe(true);
    for (const statement of statements) {
      expect(statement.bind).toHaveBeenCalledWith("restaurant-1");
    }
  });

  it("lists and reads templates from cache or service results", async () => {
    mocks.cache.get.mockResolvedValueOnce([{ id: 1, name: "Cached" }]);
    await expect(createService().listTemplates()).resolves.toEqual([
      { id: 1, name: "Cached" },
    ]);

    mocks.cache.get.mockResolvedValueOnce(null);
    mocks.qrService.getActiveTemplates.mockResolvedValue([
      {
        id: 2,
        name: "Modern",
        description: "Clean",
        styleJson: '{"size":256}',
        isActive: true,
        createdAt: "2026-06-07T00:00:00.000Z",
        updatedAt: "2026-06-07T00:00:00.000Z",
      },
    ]);

    await expect(
      createService().listTemplates("modern"),
    ).resolves.toMatchObject([
      { id: 2, name: "Modern", category: "modern", style: { size: 256 } },
    ]);

    mocks.cache.get.mockResolvedValueOnce(null);
    mocks.qrService.getTemplate.mockResolvedValue(null);
    await expect(createService().getTemplate(99)).resolves.toBeNull();
  });

  it("creates, updates, and deletes templates while clearing caches", async () => {
    mocks.qrService.createTemplate.mockResolvedValue({
      id: 1,
      name: "Classic",
      description: "Readable",
      styleJson: '{"size":300}',
      isActive: true,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });

    await expect(
      createService().createTemplate({
        name: "Classic",
        description: "Readable",
        category: "classic",
        style: { size: 300 },
        createdBy: 7,
      }),
    ).resolves.toMatchObject({
      id: 1,
      category: "classic",
      style: { size: 300 },
    });
    expect(mocks.cache.clear).toHaveBeenCalledWith("qr-templates:");

    mocks.qrService.updateTemplate.mockResolvedValue({
      id: 1,
      name: "Updated",
      description: "Readable",
      styleJson: '{"size":400}',
      isActive: true,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
    });

    await expect(
      createService().updateTemplate(1, {
        name: "Updated",
        category: "branded",
        style: { size: 400 },
      }),
    ).resolves.toMatchObject({
      name: "Updated",
      category: "branded",
      style: { size: 400 },
    });
    expect(mocks.cache.delete).toHaveBeenCalledWith("qr-template:1");

    mocks.qrService.deleteTemplate.mockResolvedValue(undefined);
    await expect(createService().deleteTemplate(1)).resolves.toBe(true);

    mocks.qrService.deleteTemplate.mockRejectedValueOnce(new Error("db"));
    await expect(createService().deleteTemplate(2)).resolves.toBe(false);
  });
});
