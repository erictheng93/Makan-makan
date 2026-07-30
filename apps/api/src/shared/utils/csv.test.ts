import { describe, expect, it } from "vitest";
import { escapeCsvValue, toCsv, toCsvRow } from "./csv";

describe("escapeCsvValue", () => {
  it("passes ordinary values through unchanged", () => {
    expect(escapeCsvValue("雞排攤")).toBe("雞排攤");
    expect(escapeCsvValue("restaurant-1")).toBe("restaurant-1");
    expect(escapeCsvValue("2026-06-01T11:01:00.000Z")).toBe(
      "2026-06-01T11:01:00.000Z",
    );
    expect(escapeCsvValue(12000)).toBe("12000");
  });

  it("neutralizes cells that start with a formula character", () => {
    // Each of these executes on open in Excel / Sheets / LibreOffice.
    expect(
      escapeCsvValue('=HYPERLINK("http://evil.test","claim refund")'),
    ).toBe(`"'=HYPERLINK(""http://evil.test"",""claim refund"")"`);
    expect(escapeCsvValue("+1+cmd|'/C calc'!A0")).toBe("'+1+cmd|'/C calc'!A0");
    expect(escapeCsvValue("-2+3+cmd|'/C calc'!A0")).toBe(
      "'-2+3+cmd|'/C calc'!A0",
    );
    expect(escapeCsvValue("@SUM(1+9)*cmd|'/C calc'!A0")).toBe(
      "'@SUM(1+9)*cmd|'/C calc'!A0",
    );
  });

  it("neutralizes leading whitespace that hides a formula character", () => {
    // A TAB needs no RFC 4180 quoting, a CR does.
    expect(escapeCsvValue("\t=1+1")).toBe("'\t=1+1");
    expect(escapeCsvValue("\r=1+1")).toBe('"\'\r=1+1"');
  });

  it("leaves numeric literals numeric instead of prefixing them", () => {
    // net_paid_amount_cents goes negative when refunds exceed payments; the
    // accounting exports must keep those cells parseable as numbers.
    expect(escapeCsvValue(-500)).toBe("-500");
    expect(escapeCsvValue("-500")).toBe("-500");
    expect(escapeCsvValue("+12.5")).toBe("+12.5");
    expect(escapeCsvValue("-1.5e3")).toBe("-1.5e3");
  });

  it("quotes and doubles embedded double quotes", () => {
    expect(escapeCsvValue('阿明"炸雞"攤')).toBe('"阿明""炸雞""攤"');
  });

  it("quotes embedded commas", () => {
    expect(escapeCsvValue("Ada, Bob & Co")).toBe('"Ada, Bob & Co"');
  });

  it("quotes embedded newlines and carriage returns", () => {
    expect(escapeCsvValue("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvValue("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("renders null and undefined as empty cells", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("renders Date values as ISO strings", () => {
    expect(escapeCsvValue(new Date("2026-06-01T12:00:00.000Z"))).toBe(
      "2026-06-01T12:00:00.000Z",
    );
  });
});

describe("toCsvRow / toCsv", () => {
  it("joins escaped cells with commas without shifting columns", () => {
    expect(toCsvRow(["restaurant-1", "Ada, Bob", "=1+1", 880])).toBe(
      'restaurant-1,"Ada, Bob",\'=1+1,880',
    );
  });

  it("joins rows with newlines, header row first", () => {
    expect(
      toCsv([
        ["restaurant_id", "restaurant_name"],
        ["restaurant-1", "雞排攤"],
        ["restaurant-2", "=cmd|'/C calc'!A0"],
      ]),
    ).toBe(
      "restaurant_id,restaurant_name\n" +
        "restaurant-1,雞排攤\n" +
        "restaurant-2,'=cmd|'/C calc'!A0",
    );
  });
});
