import { describe, expect, it, vi } from "vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { ExportService } from "./ExportService";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function createDatabase(records: Record<string, unknown>[]): D1Database {
  const all = vi.fn().mockResolvedValue({ results: records });
  const bind = vi.fn().mockReturnValue({ all });
  const prepare = vi.fn().mockReturnValue({ bind });

  return { prepare } as unknown as D1Database;
}

describe("ExportService", () => {
  it("does not label CSV leave request exports as XLSX files", async () => {
    const service = new ExportService(
      createDatabase([
        {
          id: 1,
          employee_name: "Ada",
          status: "approved",
        },
      ]),
    );

    const result = await service.exportLeaveRequests("restaurant-1", {
      format: "excel",
    });

    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/\.csv$/);
    expect(result.filename).not.toMatch(/\.xlsx$/);
    expect(result.mimeType).toBe("text/csv;charset=utf-8");
    expect(result.mimeType).not.toBe(XLSX_MIME);
    expect(result.data).toContain("employee_name");
  });
});
