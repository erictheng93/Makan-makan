import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  businessDateNow,
  dateFromUnixMs,
  juliandayFromUnixMs,
  strftimeFromUnixMs,
  unixMsDiffMinutes,
} from "./sql-time";

function render(expression: { toQuery: (config: unknown) => { sql: string } }) {
  return expression.toQuery({
    escapeName: (name: string) => `"${name}"`,
    escapeParam: () => "?",
    escapeString: (value: string) => `'${value}'`,
    casing: { getColumnCasing: (column: { name: string }) => column.name },
  }).sql;
}

describe("SQL time helpers", () => {
  it("converts Unix millisecond columns to local business dates", () => {
    expect(render(dateFromUnixMs(sql.raw("created_at_ms")))).toBe(
      "DATE(created_at_ms / 1000, 'unixepoch', '+8 hours')",
    );
  });

  it("builds strftime buckets from Unix millisecond columns", () => {
    expect(render(strftimeFromUnixMs("%Y-%m", sql.raw("created_at_ms")))).toBe(
      "strftime(?, created_at_ms / 1000, 'unixepoch', '+8 hours')",
    );
  });

  it("builds current local business date without host timezone dependence", () => {
    expect(render(businessDateNow())).toBe("DATE('now', '+8 hours')");
  });

  it("builds julianday differences from Unix millisecond columns", () => {
    expect(render(juliandayFromUnixMs(sql.raw("ready_at_ms")))).toBe(
      "julianday(ready_at_ms / 1000, 'unixepoch')",
    );
    expect(
      render(
        unixMsDiffMinutes(sql.raw("ready_at_ms"), sql.raw("created_at_ms")),
      ),
    ).toBe(
      "(julianday(ready_at_ms / 1000, 'unixepoch') - julianday(created_at_ms / 1000, 'unixepoch')) * 24 * 60",
    );
  });
});
