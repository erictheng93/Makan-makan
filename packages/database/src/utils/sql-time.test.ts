import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  businessDateNow,
  businessOffsetModifier,
  dateFromUnixMs,
  juliandayFromUnixMs,
  strftimeFromUnixMs,
  strftimeNow,
  unixMsDiffMinutes,
} from "./sql-time";

function render(expression: {
  toQuery: (config: unknown) => { sql: string; params: unknown[] };
}) {
  return expression.toQuery({
    escapeName: (name: string) => `"${name}"`,
    escapeParam: () => "?",
    escapeString: (value: string) => `'${value}'`,
    casing: { getColumnCasing: (column: { name: string }) => column.name },
  });
}

const TAIPEI = 8 * 60;
const TOKYO = 9 * 60;
const HO_CHI_MINH = 7 * 60;

describe("SQL time helpers", () => {
  it("renders an offset as a SQLite date modifier", () => {
    expect(businessOffsetModifier(TAIPEI)).toBe("+480 minutes");
    expect(businessOffsetModifier(TOKYO)).toBe("+540 minutes");
    expect(businessOffsetModifier(HO_CHI_MINH)).toBe("+420 minutes");
    expect(businessOffsetModifier(0)).toBe("+0 minutes");
    expect(businessOffsetModifier(-5 * 60)).toBe("-300 minutes");
    expect(businessOffsetModifier(5.5 * 60)).toBe("+330 minutes");
  });

  it("converts Unix millisecond columns to business dates at the given offset", () => {
    const taipei = render(dateFromUnixMs(sql.raw("created_at_ms"), TAIPEI));
    expect(taipei.sql).toBe("DATE(created_at_ms / 1000, 'unixepoch', ?)");
    expect(taipei.params).toEqual(["+480 minutes"]);

    // The whole point of #329: two shops, same column, different day boundary.
    expect(
      render(dateFromUnixMs(sql.raw("created_at_ms"), TOKYO)).params,
    ).toEqual(["+540 minutes"]);
  });

  it("builds strftime buckets from Unix millisecond columns", () => {
    const bucket = render(
      strftimeFromUnixMs("%Y-%m", sql.raw("created_at_ms"), HO_CHI_MINH),
    );
    expect(bucket.sql).toBe(
      "strftime(?, created_at_ms / 1000, 'unixepoch', ?)",
    );
    expect(bucket.params).toEqual(["%Y-%m", "+420 minutes"]);
  });

  it("builds the current business date at the given offset", () => {
    const now = render(businessDateNow(TOKYO));
    expect(now.sql).toBe("DATE('now', ?)");
    expect(now.params).toEqual(["+540 minutes"]);
  });

  it("builds strftime over 'now' with trailing modifiers", () => {
    const month = render(strftimeNow("%Y-%m", TOKYO));
    expect(month.sql).toBe("strftime(?, 'now', ?)");
    expect(month.params).toEqual(["%Y-%m", "+540 minutes"]);

    const previousMonth = render(
      strftimeNow("%Y-%m", TOKYO, "start of month", "-1 month"),
    );
    expect(previousMonth.sql).toBe("strftime(?, 'now', ?, ?, ?)");
    expect(previousMonth.params).toEqual([
      "%Y-%m",
      "+540 minutes",
      "start of month",
      "-1 month",
    ]);
  });

  it("builds julianday differences from Unix millisecond columns", () => {
    expect(render(juliandayFromUnixMs(sql.raw("ready_at_ms"))).sql).toBe(
      "julianday(ready_at_ms / 1000, 'unixepoch')",
    );
    expect(
      render(
        unixMsDiffMinutes(sql.raw("ready_at_ms"), sql.raw("created_at_ms")),
      ).sql,
    ).toBe(
      "(julianday(ready_at_ms / 1000, 'unixepoch') - julianday(created_at_ms / 1000, 'unixepoch')) * 24 * 60",
    );
  });
});
