import { describe, expect, it } from "vitest";
import { buildSignedQRUrl } from "@makanmakan/utils";
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

describe("qr-parser shop QR support", () => {
  it("parses production shop QR codes that carry UUID restaurant ids", () => {
    const data = parseQRContent(
      "SHOP-019fa136-cfe3-709f-a2ab-f8a3ebcd31a1-1785563580",
    );

    expect(data).toMatchObject({
      type: "shop",
      restaurantId: "019fa136-cfe3-709f-a2ab-f8a3ebcd31a1",
      shopQrCode: "SHOP-019fa136-cfe3-709f-a2ab-f8a3ebcd31a1-1785563580",
      source: "shop",
    });
    expect(data && validateQRData(data)).toBe(true);
  });
});

describe("qr-parser signed table and seat QR support", () => {
  const signingKey = "test-qr-signing-key-at-least-32-characters";

  it("parses and validates a v2 table URL produced by buildSignedQRUrl", async () => {
    const qrCode = await buildSignedQRUrl(
      "https://customer.example.test",
      {
        type: "table",
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableId: 10,
        identifier: "A1",
        version: 3,
      },
      signingKey,
    );

    const data = parseQRContent(qrCode);

    expect(data).toMatchObject({
      type: "table",
      restaurantId: "019469a0-0001-7000-8000-000000000001",
      tableId: 10,
      tableNumber: "A1",
      formatVersion: 2,
      source: "url",
    });
    expect(data && validateQRData(data)).toBe(true);
  });

  it("keeps a v2 seat number as a string instead of coercing it to seatId", async () => {
    const qrCode = await buildSignedQRUrl(
      "https://customer.example.test",
      {
        type: "seat",
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableId: 10,
        identifier: "VIP-1",
        version: 4,
      },
      signingKey,
    );

    const data = parseQRContent(qrCode);

    expect(data).toMatchObject({
      type: "seat",
      restaurantId: "019469a0-0001-7000-8000-000000000001",
      tableId: 10,
      seatNumber: "VIP-1",
      formatVersion: 2,
      source: "url",
    });
    expect(data).not.toHaveProperty("seatId");
    expect(data && validateQRData(data)).toBe(true);
  });
});
