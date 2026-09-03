import { describe, expect, it } from "vitest";
import { escapeCsvValue, toCsv } from "./csv";

describe("scheduling CSV serialization", () => {
  it("neutralizes spreadsheet formulas in free-text cells", () => {
    expect(escapeCsvValue('=HYPERLINK("http://evil.test","open")')).toBe(
      `"'=HYPERLINK(""http://evil.test"",""open"")"`,
    );
    expect(escapeCsvValue("+1+cmd|'/C calc'!A0")).toBe("'+1+cmd|'/C calc'!A0");
    expect(escapeCsvValue("-2+3")).toBe("'-2+3");
    expect(escapeCsvValue("@SUM(1,2)")).toBe('"\'@SUM(1,2)"');
    expect(escapeCsvValue("\t=1+1")).toBe("'\t=1+1");
    expect(escapeCsvValue("\r=1+1")).toBe('"\'\r=1+1"');
  });

  it("preserves numeric values and applies RFC 4180 quoting", () => {
    expect(escapeCsvValue("-500")).toBe("-500");
    expect(escapeCsvValue("+12.5")).toBe("+12.5");
    expect(escapeCsvValue('Lin, "Alex"')).toBe('"Lin, ""Alex"""');
    expect(
      toCsv([
        ["Employee", "Hours"],
        ["=1+1", 8],
      ]),
    ).toBe("Employee,Hours\n'=1+1,8");
  });
});
