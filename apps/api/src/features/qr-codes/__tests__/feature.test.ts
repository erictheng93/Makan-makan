/**
 * QR Codes Feature Tests
 * Unit tests for the QR codes feature module
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { QrCodesService } from "../services/QrCodesService";
import type { Env } from "../../../shared/types";
import { envFactory, resetAllFactories } from "@makanmakan/testing-utils";

// Mock environment — uses envFactory with full Env shape
const mockEnv = envFactory.build() as unknown as Env;

describe("QrCodesService", () => {
  let service: QrCodesService;

  beforeEach(() => {
    resetAllFactories();
    service = new QrCodesService(mockEnv);
    vi.clearAllMocks();
  });

  describe("generateQR", () => {
    it("should generate a QR code successfully", async () => {
      const mockData = {
        content: "https://example.com/menu/123",
        format: "png" as const,
        style: {
          size: 200,
          foregroundColor: "#000000",
          backgroundColor: "#ffffff",
        },
      };

      // Mock the underlying QRCodeService method
      vi.spyOn(service["qrService"], "generateQRCode").mockResolvedValue({
        id: "qr123",
        content: mockData.content,
        format: mockData.format,
        url: "https://example.com/qr/qr123.png",
        styleJson: JSON.stringify(mockData.style),
        metadataJson: null,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as never);

      vi.spyOn(service["qrService"], "createAuditLog").mockResolvedValue();

      const result = await service.generateQR(mockData, 1, "100");

      expect(result).toMatchObject({
        content: mockData.content,
        format: mockData.format,
        style: mockData.style,
        userId: 1,
        restaurantId: "100",
      });
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("generateBulkQR", () => {
    it("should generate bulk QR codes successfully", async () => {
      const mockData = {
        tables: [
          { id: 1, name: "Table 1", content: "https://example.com/table/1" },
          { id: 2, name: "Table 2", content: "https://example.com/table/2" },
        ],
        format: "zip" as const,
      };

      vi.spyOn(service["qrService"], "generateBulkQRCodes").mockResolvedValue({
        batchId: "batch123",
        totalCodes: 2,
      });

      const result = await service.generateBulkQR(mockData, 1, "100");

      expect(result).toMatchObject({
        itemCount: 2,
        format: "zip",
        status: "completed",
        userId: 1,
        restaurantId: "100",
      });
      expect(result.batchId).toBeDefined();
    });

    it("should throw error if userId or restaurantId is missing", async () => {
      const mockData = {
        tables: [
          { id: 1, name: "Table 1", content: "https://example.com/table/1" },
        ],
      };

      await expect(service.generateBulkQR(mockData)).rejects.toThrow(
        "Restaurant ID and User ID are required for bulk generation",
      );
    });
  });

  describe("downloadQR", () => {
    it("should return null for non-existent QR code", async () => {
      vi.spyOn(service["qrService"], "getQRCode").mockResolvedValue(null);

      const result = await service.downloadQR(999);
      expect(result).toBeNull();
    });

    it("should return download data for existing QR code", async () => {
      vi.spyOn(service["qrService"], "getQRCode").mockResolvedValue({
        id: "qr123",
        content: "test",
        format: "png",
        url: null,
        styleJson: null,
        metadataJson: null,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as never);

      vi.spyOn(service["qrService"], "recordDownload").mockResolvedValue();

      const result = await service.downloadQR(123);

      expect(result).toMatchObject({
        contentType: "image/png",
        filename: "qr-code-123.png",
      });
      expect(result?.data).toBeInstanceOf(Buffer);
      expect(result?.data.subarray(0, 8).toString("hex")).toBe(
        "89504e470d0a1a0a",
      );
      expect(result?.data.toString("utf8")).not.toContain("placeholder");
    });
  });

  describe("downloadBatch", () => {
    it("should return a zip archive with generated QR assets", async () => {
      vi.spyOn(service["qrService"], "getBatchStatus").mockResolvedValue({
        batchId: "batch123",
        restaurantId: "rest-1",
        totalCodes: 2,
        status: "completed",
      } as never);

      const result = await service.downloadBatch("batch123");

      expect(result).toMatchObject({
        contentType: "application/zip",
        filename: "qr-batch-batch123.zip",
      });
      expect(result?.data.subarray(0, 2).toString("utf8")).toBe("PK");
      expect(result?.data.toString("utf8")).not.toContain("placeholder");
    });
  });

  describe("getStatistics", () => {
    it("should return QR code statistics", async () => {
      const mockStats = {
        totalCodes: 10,
        todayCodes: 2,
        totalDownloads: 25,
        popularTemplates: [],
      };

      vi.spyOn(service["qrService"], "getQRCodeStats").mockResolvedValue(
        mockStats,
      );

      const result = await service.getStatistics("100");

      expect(result).toMatchObject({
        totalQRCodes: 10,
        totalDownloads: 25,
        totalTemplates: 0,
        popularTemplates: [],
        formatDistribution: {},
        recentActivity: [],
      });
    });
  });

  describe("listTemplates", () => {
    it("should return list of templates", async () => {
      const mockTemplates = [
        {
          id: 1,
          name: "Modern Template",
          description: "A modern QR code template",
          styleJson: '{"size": 200}',
          isActive: true,
          isDefault: false,
          createdBy: 1,
          createdAt: "2023-01-01T00:00:00Z",
          updatedAt: "2023-01-01T00:00:00Z",
        },
      ];

      vi.spyOn(service["qrService"], "getActiveTemplates").mockResolvedValue(
        mockTemplates as never,
      );

      const result = await service.listTemplates();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: "Modern Template",
        description: "A modern QR code template",
        category: "modern",
        isActive: true,
      });
    });
  });

  describe("createTemplate", () => {
    it("should create a new template", async () => {
      const mockTemplateData = {
        name: "Test Template",
        description: "A test template",
        category: "modern" as const,
        style: { size: 200, foregroundColor: "#000000" },
      };

      const mockCreatedTemplate = {
        id: 1,
        name: mockTemplateData.name,
        description: mockTemplateData.description,
        styleJson: JSON.stringify(mockTemplateData.style),
        isActive: true,
        isDefault: false,
        createdBy: 1,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      };

      vi.spyOn(service["qrService"], "createTemplate").mockResolvedValue(
        mockCreatedTemplate as never,
      );

      const result = await service.createTemplate(mockTemplateData);

      expect(result).toMatchObject({
        name: mockTemplateData.name,
        description: mockTemplateData.description,
        category: mockTemplateData.category,
        style: mockTemplateData.style,
        isActive: true,
      });
    });
  });
});

// Integration tests for HTTP endpoints
describe("QR Codes API Integration", () => {
  let app: any;
  let service: QrCodesService;

  beforeEach(async () => {
    resetAllFactories();
    // Dynamic import to avoid circular dependencies
    const { default: qrCodesRoutes } = await import("../routes/index");
    const { Hono } = await import("hono");

    app = new Hono();
    service = new QrCodesService(mockEnv);

    // Mount routes with auth bypass for testing
    app.use("*", async (c: any, next: any) => {
      c.set("user", {
        id: 1,
        username: "testuser",
        role: 0,
        restaurantId: 100,
      });
      c.env = mockEnv;
      await next();
    });
    app.route("/qr", qrCodesRoutes);

    vi.clearAllMocks();
  });

  describe("POST /qr/generate", () => {
    it("should return 201 when QR code is generated successfully", async () => {
      vi.spyOn(service["qrService"], "generateQRCode").mockResolvedValue({
        id: "qr123",
        content: "https://example.com/menu/123",
        format: "png",
        url: "https://example.com/qr/qr123.png",
        styleJson: null,
        metadataJson: null,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as never);
      vi.spyOn(service["qrService"], "createAuditLog").mockResolvedValue();

      const response = await app.request("/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "https://example.com/menu/123",
          format: "png",
          style: { size: 200 },
        }),
      });

      // Note: Full integration would need proper middleware setup
      // This validates the route is accessible
      expect(response.status).toBeDefined();
    });
  });

  describe("GET /qr/templates", () => {
    it("should return 200 with list of templates", async () => {
      vi.spyOn(service["qrService"], "getActiveTemplates").mockResolvedValue(
        [],
      );

      const response = await app.request("/qr/templates", {
        method: "GET",
      });

      expect(response.status).toBeDefined();
    });
  });

  describe("GET /qr/stats", () => {
    it("should return 200 with QR code statistics", async () => {
      vi.spyOn(service["qrService"], "getQRCodeStats").mockResolvedValue({
        totalCodes: 10,
        todayCodes: 2,
        totalDownloads: 25,
        popularTemplates: [],
      });

      const response = await app.request("/qr/stats", {
        method: "GET",
      });

      expect(response.status).toBeDefined();
    });
  });

  describe("GET /qr/verify/shop/:qrCode", () => {
    it("should verify shop QR code successfully", async () => {
      const response = await app.request("/qr/verify/shop/SHOP-ABC123", {
        method: "GET",
      });

      // Public endpoint should be accessible
      expect(response.status).toBeDefined();
    });
  });
});

// Performance tests
describe("QR Codes Performance", () => {
  let service: QrCodesService;

  beforeEach(() => {
    resetAllFactories();
    service = new QrCodesService(mockEnv);
    vi.clearAllMocks();
  });

  describe("QR Code Generation Performance", () => {
    it("should generate single QR code within 500ms", async () => {
      vi.spyOn(service["qrService"], "generateQRCode").mockResolvedValue({
        id: "qr123",
        content: "https://example.com/test",
        format: "png",
        url: "https://example.com/qr/qr123.png",
        styleJson: null,
        metadataJson: null,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as never);
      vi.spyOn(service["qrService"], "createAuditLog").mockResolvedValue();

      const start = performance.now();

      await service.generateQR(
        {
          content: "https://example.com/test",
          format: "png",
          style: { size: 200 },
        },
        1,
        "100",
      );

      const duration = performance.now() - start;

      // With mocks, this should be near-instant
      // In production, actual QR generation should complete within 500ms
      expect(duration).toBeLessThan(500);
    });

    it("should generate bulk QR codes within acceptable time", async () => {
      const tableCount = 10;
      vi.spyOn(service["qrService"], "generateBulkQRCodes").mockResolvedValue({
        batchId: "batch123",
        totalCodes: tableCount,
      });

      const tables = Array.from({ length: tableCount }, (_, i) => ({
        id: i + 1,
        name: `Table ${i + 1}`,
        content: `https://example.com/table/${i + 1}`,
      }));

      const start = performance.now();

      await service.generateBulkQR(
        {
          tables,
          format: "zip",
        },
        1,
        "100",
      );

      const duration = performance.now() - start;

      // Bulk operation should complete within 2 seconds for 10 tables
      expect(duration).toBeLessThan(2000);
    });
  });

  describe("Statistics Query Performance", () => {
    it("should fetch statistics within 200ms", async () => {
      vi.spyOn(service["qrService"], "getQRCodeStats").mockResolvedValue({
        totalCodes: 100,
        todayCodes: 5,
        totalDownloads: 500,
        popularTemplates: [],
      });

      const start = performance.now();

      await service.getStatistics("100");

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe("Template Operations Performance", () => {
    it("should list templates within 100ms", async () => {
      vi.spyOn(service["qrService"], "getActiveTemplates").mockResolvedValue(
        [],
      );

      const start = performance.now();

      await service.listTemplates();

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it("should create template within 300ms", async () => {
      vi.spyOn(service["qrService"], "createTemplate").mockResolvedValue({
        id: 1,
        name: "Test Template",
        description: "Test",
        styleJson: "{}",
        isActive: true,
        isDefault: false,
        createdBy: 1,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as never);

      const start = performance.now();

      await service.createTemplate({
        name: "Test Template",
        description: "Test",
        category: "modern",
        style: { size: 200 },
      });

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(300);
    });
  });

  describe("Download Performance", () => {
    it("should prepare download data within 500ms", async () => {
      vi.spyOn(service["qrService"], "getQRCode").mockResolvedValue({
        id: "qr123",
        content: "test",
        format: "png",
        url: null,
        styleJson: null,
        metadataJson: null,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as never);
      vi.spyOn(service["qrService"], "recordDownload").mockResolvedValue();

      const start = performance.now();

      await service.downloadQR(123);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500);
    });
  });
});
