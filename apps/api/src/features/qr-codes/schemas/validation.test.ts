import { describe, expect, it } from "vitest";
import { qrCodeSchemas } from "./validation";

describe("QR code validation schemas", () => {
  it("validates QR generation defaults and style bounds", () => {
    expect(qrCodeSchemas.generate.parse({ content: "table-1" })).toEqual({
      content: "table-1",
      format: "png",
    });

    expect(() =>
      qrCodeSchemas.generate.parse({
        content: "table-1",
        style: { size: 99 },
      }),
    ).toThrow();
  });

  it("applies bulk generation defaults", () => {
    expect(
      qrCodeSchemas.bulk.parse({
        tables: [{ id: 1, name: "A1", content: "table-1" }],
      }),
    ).toMatchObject({
      format: "zip",
      includeMetadata: true,
    });
  });

  it("validates template and query parameters", () => {
    expect(
      qrCodeSchemas.createTemplate.parse({
        name: "Minimal",
        description: "Clean table QR",
        category: "minimalist",
        style: { foregroundColor: "#111111", backgroundColor: "#ffffff" },
      }),
    ).toMatchObject({ category: "minimalist" });

    expect(
      qrCodeSchemas.listTemplates.parse({
        page: "2",
        limit: "10",
        isActive: "true",
      }),
    ).toEqual({ page: 2, limit: 10, isActive: true });
  });

  it("accepts supported shop QR formats", () => {
    expect(
      qrCodeSchemas.shopQrCode.parse({ qrCode: "SHOP-GRANDMA-001" }),
    ).toEqual({ qrCode: "SHOP-GRANDMA-001" });
    expect(
      qrCodeSchemas.shopQrCode.parse({
        qrCode: "SHOP-019fa136-cfe3-709f-a2ab-f8a3ebcd31a1-1785563580",
      }),
    ).toEqual({
      qrCode: "SHOP-019fa136-cfe3-709f-a2ab-f8a3ebcd31a1-1785563580",
    });
    expect(() => qrCodeSchemas.shopQrCode.parse({ qrCode: "TABLE-1" })).toThrow(
      "Invalid shop QR code format",
    );
  });
});
