import { describe, expect, it } from "vitest";
import {
  generateQRContent,
  getQRTypeDescription,
  parseQRContent,
  validateQRData,
} from "@/utils/qr-parser";

describe("qr-parser market QR support", () => {
  it("parses a simple market QR code", () => {
    const data = parseQRContent("MARKET-fengjia-night-market");

    expect(data).toMatchObject({
      type: "market",
      marketSlug: "fengjia-night-market",
      source: "market",
    });
    expect(data && validateQRData(data)).toBe(true);
  });

  it("parses a market detail URL QR code", () => {
    const data = parseQRContent("https://makanmakan.app/markets/fengjia");

    expect(data).toMatchObject({
      type: "market",
      marketSlug: "fengjia",
      marketUrl: "/markets/fengjia",
      source: "url",
    });
    expect(data && validateQRData(data)).toBe(true);
  });

  it("generates market QR content for printable signs", () => {
    expect(generateQRContent("market", "fengjia", { format: "simple" })).toBe(
      "MARKET-fengjia",
    );
    expect(generateQRContent("market", "fengjia", { format: "url" })).toBe(
      "https://makanmakan.app/markets/fengjia",
    );
    expect(JSON.parse(generateQRContent("market", "fengjia"))).toEqual({
      type: "market",
      marketSlug: "fengjia",
    });
    expect(getQRTypeDescription("market")).toContain("夜市");
  });
});
