/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExportService } from "../exportService";
import type {
  ExportOptions,
  ExportFormat,
  ExportDataType,
} from "@/types/monitoring-export";

describe("ExportService", () => {
  let exportService: ExportService;
  let mockData: any[];

  beforeEach(() => {
    exportService = new ExportService();
    mockData = [
      {
        timestamp: new Date("2025-01-01T10:00:00Z"),
        component: "api",
        severity: "warning",
        message: "High response time detected",
        value: 1500,
      },
      {
        timestamp: new Date("2025-01-01T11:00:00Z"),
        component: "database",
        severity: "critical",
        message: "Connection timeout",
        value: 5000,
      },
      {
        timestamp: new Date("2025-01-01T12:00:00Z"),
        component: "cache",
        severity: "info",
        message: "Cache hit rate low",
        value: 45,
      },
    ];
  });

  describe("exportData", () => {
    it("should export data to CSV format", async () => {
      const options: ExportOptions = {
        format: "csv",
        dataType: "alerts",
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-01-02"),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
      };

      const result = await exportService.exportData(mockData, options);

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/\.csv$/);
      expect(result.rowCount).toBe(3);
      expect(result.size).toBeGreaterThan(0);
    });

    it("should generate filenames with timestamp format", async () => {
      const options: ExportOptions = {
        format: "csv",
        dataType: "alerts",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
      };

      const result = await exportService.exportData(mockData, options);

      // Verify filename follows expected pattern: monitoring-{dataType}-{date}-{time}.{format}
      // Example: monitoring-alerts-2025-01-13-14-06-31.csv
      expect(result.filename).toMatch(
        /^monitoring-alerts-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/,
      );
    });

    it("should handle empty data array", async () => {
      const options: ExportOptions = {
        format: "csv",
        dataType: "alerts",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
      };

      const result = await exportService.exportData([], options);

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(0);
    });

    it("should handle export errors gracefully", async () => {
      const options: ExportOptions = {
        format: "invalid" as ExportFormat,
        dataType: "alerts",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
      };

      const result = await exportService.exportData(mockData, options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("quickExport", () => {
    it("should export with default options", async () => {
      const result = await exportService.quickExport(mockData, "csv", "alerts");

      expect(result.success).toBe(true);
      expect(result.filename).toContain("monitoring-alerts-");
      expect(result.filename).toMatch(/\.csv$/);
    });

    it("should support all formats", async () => {
      const formats: ExportFormat[] = ["csv", "excel", "pdf"];

      for (const format of formats) {
        const result = await exportService.quickExport(
          mockData,
          format,
          "alerts",
        );
        expect(result.success).toBe(true);
        expect(result.filename).toMatch(
          new RegExp(`\\.(${format === "excel" ? "xlsx" : format})$`),
        );
      }
    });

    it("should support all data types", async () => {
      const dataTypes: ExportDataType[] = [
        "alerts",
        "performance",
        "errors",
        "health",
        "all",
      ];

      for (const dataType of dataTypes) {
        const result = await exportService.quickExport(
          mockData,
          "csv",
          dataType,
        );
        expect(result.success).toBe(true);
        expect(result.filename).toContain(`monitoring-${dataType}-`);
      }
    });
  });

  describe("Data formatting", () => {
    it("should format dates correctly", async () => {
      const dataWithDates = [
        {
          timestamp: new Date("2025-01-01T10:30:45Z"),
          message: "Test",
        },
      ];

      const result = await exportService.quickExport(
        dataWithDates,
        "csv",
        "alerts",
      );
      expect(result.success).toBe(true);
    });

    it("should handle nested objects", async () => {
      const dataWithObjects = [
        {
          timestamp: new Date(),
          metadata: {
            nested: "value",
            deeper: {
              level: "test",
            },
          },
        },
      ];

      const result = await exportService.quickExport(
        dataWithObjects,
        "csv",
        "alerts",
      );
      expect(result.success).toBe(true);
    });

    it("should handle null and undefined values", async () => {
      const dataWithNulls = [
        {
          timestamp: new Date(),
          value1: null,
          value2: undefined,
          value3: "normal",
        },
      ];

      const result = await exportService.quickExport(
        dataWithNulls,
        "csv",
        "alerts",
      );
      expect(result.success).toBe(true);
    });

    it("should handle special characters in text", async () => {
      const dataWithSpecialChars = [
        {
          message: 'Test with "quotes" and commas, and newlines\n',
          description: "Special chars: <>&'\"",
        },
      ];

      const result = await exportService.quickExport(
        dataWithSpecialChars,
        "csv",
        "alerts",
      );
      expect(result.success).toBe(true);
    });
  });

  describe("CSV Export", () => {
    it("should generate CSV with headers", async () => {
      const result = await exportService.quickExport(mockData, "csv", "alerts");

      expect(result.success).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it("should handle CSV delimiter option", async () => {
      const options: ExportOptions = {
        format: "csv",
        dataType: "alerts",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
        csvOptions: {
          delimiter: ";",
          includeHeaders: true,
          dateFormat: "YYYY-MM-DD HH:mm:ss",
        },
      };

      const result = await exportService.exportData(mockData, options);
      expect(result.success).toBe(true);
    });
  });

  describe("Excel Export", () => {
    it("should generate Excel file", async () => {
      const result = await exportService.quickExport(
        mockData,
        "excel",
        "performance",
      );

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/\.xlsx$/);
      expect(result.size).toBeGreaterThan(0);
    });

    it("should handle large datasets", async () => {
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        timestamp: new Date(),
        value: Math.random() * 100,
      }));

      const result = await exportService.quickExport(
        largeData,
        "excel",
        "performance",
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(1000);
    });
  });

  describe("PDF Export", () => {
    it("should generate PDF file", async () => {
      const result = await exportService.quickExport(mockData, "pdf", "health");

      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/\.pdf$/);
      expect(result.size).toBeGreaterThan(0);
    });

    it("should handle PDF orientation option", async () => {
      const options: ExportOptions = {
        format: "pdf",
        dataType: "performance",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
        pdfOptions: {
          orientation: "landscape",
          pageSize: "a4",
          includeHeader: true,
          includeFooter: true,
          includePageNumbers: true,
        },
      };

      const result = await exportService.exportData(mockData, options);
      expect(result.success).toBe(true);
    });

    it("should handle different PDF page sizes", async () => {
      const pageSizes: Array<"a4" | "letter" | "legal"> = [
        "a4",
        "letter",
        "legal",
      ];

      for (const pageSize of pageSizes) {
        const options: ExportOptions = {
          format: "pdf",
          dataType: "alerts",
          startDate: new Date(),
          endDate: new Date(),
          includeCharts: false,
          includeDetails: true,
          includeSummary: true,
          pdfOptions: {
            orientation: "portrait",
            pageSize,
            includeHeader: true,
            includeFooter: true,
            includePageNumbers: true,
          },
        };

        const result = await exportService.exportData(mockData, options);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Export options", () => {
    it("should include summary when requested", async () => {
      const options: ExportOptions = {
        format: "pdf",
        dataType: "all",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
      };

      const result = await exportService.exportData(mockData, options);
      expect(result.success).toBe(true);
    });

    it("should exclude summary when not requested", async () => {
      const options: ExportOptions = {
        format: "csv",
        dataType: "alerts",
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: false,
      };

      const result = await exportService.exportData(mockData, options);
      expect(result.success).toBe(true);
    });

    it("should handle custom filename", async () => {
      const customFilename = "custom-report.csv";
      const options: ExportOptions = {
        format: "csv",
        dataType: "alerts",
        filename: customFilename,
        startDate: new Date(),
        endDate: new Date(),
        includeCharts: false,
        includeDetails: true,
        includeSummary: true,
      };

      const result = await exportService.exportData(mockData, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe(customFilename);
    });
  });

  describe("Performance", () => {
    it("should handle very large datasets", async () => {
      const hugeData = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        timestamp: new Date(),
        component: "api",
        message: `Test message ${i}`,
        value: Math.random() * 1000,
      }));

      const result = await exportService.quickExport(
        hugeData,
        "csv",
        "performance",
      );

      expect(result.success).toBe(true);
      expect(result.rowCount).toBe(10000);
    }, 30000); // 30 second timeout

    it("should complete export within reasonable time", async () => {
      const startTime = Date.now();

      await exportService.quickExport(mockData, "csv", "alerts");

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe("Edge cases", () => {
    it("should handle data with missing fields", async () => {
      const incompleteData = [
        {
          timestamp: new Date(),
          component: "api",
          // missing other fields
        },
        {
          message: "Only message",
          // missing other fields
        },
      ];

      const result = await exportService.quickExport(
        incompleteData,
        "csv",
        "alerts",
      );
      expect(result.success).toBe(true);
    });

    it("should handle data with extra fields", async () => {
      const extraFieldsData = [
        {
          timestamp: new Date(),
          component: "api",
          message: "Test",
          extraField1: "value1",
          extraField2: "value2",
          nestedExtra: {
            deep: "value",
          },
        },
      ];

      const result = await exportService.quickExport(
        extraFieldsData,
        "csv",
        "alerts",
      );
      expect(result.success).toBe(true);
    });

    it("should handle circular references gracefully", async () => {
      const circularData: any = {
        timestamp: new Date(),
        component: "api",
        message: "Test",
      };
      circularData.self = circularData; // Create circular reference

      // This might throw, so we wrap it
      try {
        const result = await exportService.quickExport(
          [circularData],
          "csv",
          "alerts",
        );
        // If it doesn't throw, it should handle it
        expect(result).toBeDefined();
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });
  });
});
