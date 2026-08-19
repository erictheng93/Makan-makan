import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { ExportService } from "./exportService";
import type { ExportOptions } from "@/types/monitoring-export";

type PrivateExportService = {
  exportToCSV(
    data: Array<Record<string, unknown>>,
    options: ExportOptions,
  ): Promise<Blob>;
  exportToExcel(
    data: Array<Record<string, unknown>>,
    options: ExportOptions,
  ): Promise<Blob>;
};

function buildOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    format: "csv",
    dataType: "alerts",
    startDate: new Date(0),
    endDate: new Date(0),
    includeCharts: false,
    includeDetails: true,
    includeSummary: false,
    ...overrides,
  };
}

describe("ExportService.formatDataRow", () => {
  const service = new ExportService() as unknown as PrivateExportService;
  const row = { id: "a1", severity: undefined, message: "boom" };

  it("keeps undefined fields as blank CSV cells", async () => {
    const blob = await service.exportToCSV([row], buildOptions());

    await expect(blob.text()).resolves.toBe("id,severity,message\r\na1,,boom");
  });

  it("keeps undefined fields as blank Excel cells", async () => {
    const blob = await service.exportToExcel(
      [row],
      buildOptions({ format: "excel" }),
    );

    const wb = XLSX.read(await blob.arrayBuffer(), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    expect(sheet.B2).toBeUndefined();
    expect(sheet.C2?.v).toBe("boom");
  });
});
