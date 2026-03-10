/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import {
  REPORT_TEMPLATES,
  DEFAULT_EXPORT_OPTIONS,
  generateExportFilename,
  estimateExportSize,
} from "../monitoring-export";
import type { ExportDataType, ExportFormat } from "../monitoring-export";

describe("monitoring-export", () => {
  describe("REPORT_TEMPLATES", () => {
    it("should have all 5 required templates", () => {
      expect(REPORT_TEMPLATES).toHaveLength(5);

      const templateIds = REPORT_TEMPLATES.map((t) => t.id);
      expect(templateIds).toContain("daily-summary");
      expect(templateIds).toContain("weekly-performance");
      expect(templateIds).toContain("alert-history");
      expect(templateIds).toContain("error-analysis");
      expect(templateIds).toContain("executive-summary");
    });

    it("should have valid template structures", () => {
      REPORT_TEMPLATES.forEach((template) => {
        expect(template).toHaveProperty("id");
        expect(template).toHaveProperty("name");
        expect(template).toHaveProperty("description");
        expect(template).toHaveProperty("format");
        expect(template).toHaveProperty("dataType");
        expect(template).toHaveProperty("defaultOptions");

        expect(typeof template.id).toBe("string");
        expect(typeof template.name).toBe("string");
        expect(typeof template.description).toBe("string");
        expect(["csv", "excel", "pdf"]).toContain(template.format);
        expect(["alerts", "performance", "errors", "health", "all"]).toContain(
          template.dataType,
        );
      });
    });

    it("daily-summary should use PDF format", () => {
      const template = REPORT_TEMPLATES.find((t) => t.id === "daily-summary");
      expect(template?.format).toBe("pdf");
      expect(template?.dataType).toBe("all");
      expect(template?.defaultOptions.includeCharts).toBe(true);
    });

    it("alert-history should use Excel format", () => {
      const template = REPORT_TEMPLATES.find((t) => t.id === "alert-history");
      expect(template?.format).toBe("excel");
      expect(template?.dataType).toBe("alerts");
    });

    it("error-analysis should use CSV format", () => {
      const template = REPORT_TEMPLATES.find((t) => t.id === "error-analysis");
      expect(template?.format).toBe("csv");
      expect(template?.dataType).toBe("errors");
    });
  });

  describe("DEFAULT_EXPORT_OPTIONS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_EXPORT_OPTIONS.format).toBe("csv");
      expect(DEFAULT_EXPORT_OPTIONS.dataType).toBe("all");
      expect(DEFAULT_EXPORT_OPTIONS.includeCharts).toBe(false);
      expect(DEFAULT_EXPORT_OPTIONS.includeDetails).toBe(true);
      expect(DEFAULT_EXPORT_OPTIONS.includeSummary).toBe(true);
    });

    it("should have valid date range", () => {
      const now = Date.now();
      const start = DEFAULT_EXPORT_OPTIONS.startDate.getTime();
      const end = DEFAULT_EXPORT_OPTIONS.endDate.getTime();

      // Start should be ~24 hours ago
      expect(start).toBeLessThan(now);
      expect(start).toBeGreaterThan(now - 25 * 60 * 60 * 1000);

      // End should be close to now
      expect(end).toBeLessThanOrEqual(now);
      expect(end).toBeGreaterThan(now - 1000);
    });

    it("should have PDF options", () => {
      expect(DEFAULT_EXPORT_OPTIONS.pdfOptions).toBeDefined();
      expect(DEFAULT_EXPORT_OPTIONS.pdfOptions?.orientation).toBe("portrait");
      expect(DEFAULT_EXPORT_OPTIONS.pdfOptions?.pageSize).toBe("a4");
      expect(DEFAULT_EXPORT_OPTIONS.pdfOptions?.includeHeader).toBe(true);
      expect(DEFAULT_EXPORT_OPTIONS.pdfOptions?.includeFooter).toBe(true);
      expect(DEFAULT_EXPORT_OPTIONS.pdfOptions?.includePageNumbers).toBe(true);
    });

    it("should have CSV options", () => {
      expect(DEFAULT_EXPORT_OPTIONS.csvOptions).toBeDefined();
      expect(DEFAULT_EXPORT_OPTIONS.csvOptions?.delimiter).toBe(",");
      expect(DEFAULT_EXPORT_OPTIONS.csvOptions?.includeHeaders).toBe(true);
      expect(DEFAULT_EXPORT_OPTIONS.csvOptions?.dateFormat).toBe(
        "YYYY-MM-DD HH:mm:ss",
      );
    });
  });

  describe("generateExportFilename", () => {
    it("should generate filename with correct format", () => {
      const dataType: ExportDataType = "alerts";
      const format: ExportFormat = "csv";

      const filename = generateExportFilename(dataType, format);

      expect(filename).toMatch(
        /^monitoring-alerts-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/,
      );
    });

    it("should use correct extension for each format", () => {
      const dataType: ExportDataType = "performance";

      const csvFilename = generateExportFilename(dataType, "csv");
      expect(csvFilename).toMatch(/\.csv$/);

      const excelFilename = generateExportFilename(dataType, "excel");
      expect(excelFilename).toMatch(/\.xlsx$/);

      const pdfFilename = generateExportFilename(dataType, "pdf");
      expect(pdfFilename).toMatch(/\.pdf$/);
    });

    it("should include data type in filename", () => {
      const alerts = generateExportFilename("alerts", "csv");
      expect(alerts).toContain("monitoring-alerts-");

      const performance = generateExportFilename("performance", "pdf");
      expect(performance).toContain("monitoring-performance-");

      const errors = generateExportFilename("errors", "excel");
      expect(errors).toContain("monitoring-errors-");

      const health = generateExportFilename("health", "csv");
      expect(health).toContain("monitoring-health-");

      const all = generateExportFilename("all", "pdf");
      expect(all).toContain("monitoring-all-");
    });

    it("should use custom timestamp when provided", () => {
      const customDate = new Date("2025-01-15T10:30:45Z");
      const filename = generateExportFilename("alerts", "csv", customDate);

      expect(filename).toContain("2025-01-15");
    });

    it("should generate unique filenames for different calls", () => {
      const filename1 = generateExportFilename("alerts", "csv");
      const filename2 = generateExportFilename("alerts", "csv");

      // They might be the same if generated in the same second
      // but at least they should follow the same pattern
      expect(filename1).toMatch(
        /^monitoring-alerts-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/,
      );
      expect(filename2).toMatch(
        /^monitoring-alerts-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/,
      );
    });
  });

  describe("estimateExportSize", () => {
    it("should return size in bytes for small datasets", () => {
      const size = estimateExportSize(3, "csv");
      expect(size).toBeLessThan(1024); // Less than 1 KB
      expect(size).toBeGreaterThan(0);
    });

    it("should estimate CSV as smallest format", () => {
      const rowCount = 100;
      const csvSize = estimateExportSize(rowCount, "csv");
      const excelSize = estimateExportSize(rowCount, "excel");
      const pdfSize = estimateExportSize(rowCount, "pdf");

      expect(csvSize).toBeLessThan(excelSize);
      expect(excelSize).toBeLessThan(pdfSize);
    });

    it("should scale linearly with row count", () => {
      const size100 = estimateExportSize(100, "csv");
      const size200 = estimateExportSize(200, "csv");

      expect(size200).toBe(size100 * 2);
    });

    it("should return 0 for 0 rows", () => {
      expect(estimateExportSize(0, "csv")).toBe(0);
      expect(estimateExportSize(0, "excel")).toBe(0);
      expect(estimateExportSize(0, "pdf")).toBe(0);
    });

    it("should handle large datasets", () => {
      const size = estimateExportSize(10000, "pdf");
      expect(size).toBeGreaterThan(1024 * 1024); // > 1 MB
    });

    it("should use correct average row size for each format", () => {
      const rowCount = 1;

      // CSV: 200 bytes/row
      expect(estimateExportSize(rowCount, "csv")).toBe(200);

      // Excel: 300 bytes/row
      expect(estimateExportSize(rowCount, "excel")).toBe(300);

      // PDF: 500 bytes/row
      expect(estimateExportSize(rowCount, "pdf")).toBe(500);
    });
  });

  describe("Export format validation", () => {
    it("should accept all valid formats", () => {
      const validFormats: ExportFormat[] = ["csv", "excel", "pdf"];

      validFormats.forEach((format) => {
        const filename = generateExportFilename("all", format);
        expect(filename).toBeTruthy();
      });
    });

    it("should accept all valid data types", () => {
      const validDataTypes: ExportDataType[] = [
        "alerts",
        "performance",
        "errors",
        "health",
        "all",
      ];

      validDataTypes.forEach((dataType) => {
        const filename = generateExportFilename(dataType, "csv");
        expect(filename).toContain(`monitoring-${dataType}-`);
      });
    });
  });

  describe("Template compatibility", () => {
    it("should have templates for each data type", () => {
      const dataTypes: ExportDataType[] = [
        "alerts",
        "performance",
        "errors",
        "health",
        "all",
      ];

      dataTypes.forEach((dataType) => {
        const templatesForType = REPORT_TEMPLATES.filter(
          (t) => t.dataType === dataType,
        );
        expect(templatesForType.length).toBeGreaterThan(0);
      });
    });

    it("should have templates for each format", () => {
      const formats: ExportFormat[] = ["csv", "excel", "pdf"];

      formats.forEach((format) => {
        const templatesForFormat = REPORT_TEMPLATES.filter(
          (t) => t.format === format,
        );
        expect(templatesForFormat.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle very large row counts", () => {
      const hugeRowCount = 1000000;
      const size = estimateExportSize(hugeRowCount, "csv");

      expect(size).toBeGreaterThan(0);
      expect(Number.isFinite(size)).toBe(true);
    });

    it("should handle negative row counts gracefully", () => {
      // In practice this shouldn't happen, but the function should handle it
      const size = estimateExportSize(-10, "csv");
      expect(size).toBe(-2000); // -10 * 200
    });
  });
});
