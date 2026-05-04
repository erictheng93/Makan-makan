/**
 * PrintContentValidator 測試
 * 驗證列印內容驗證器的各項功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PrintContentValidator } from "../utils/PrintContentValidator";
import type { PrintContent } from "@makanmasak/shared-types";
import { printJobFactory, resetAllFactories } from "@makanmasak/testing-utils";

/**
 * 從 printJobFactory 取得基礎 PrintContent
 */
function buildBasePrintContent(
  overrides?: Partial<PrintContent>,
): PrintContent {
  const job = printJobFactory.build();
  return { ...job.content, ...overrides };
}

describe("PrintContentValidator", () => {
  beforeEach(() => {
    resetAllFactories();
  });

  describe("validate — 基礎驗證", () => {
    it("所有必要區段都存在時，isValid 應為 true", () => {
      const content = buildBasePrintContent();

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("缺少 header 時應回傳錯誤", () => {
      const content = buildBasePrintContent();
      // @ts-expect-error — 故意移除 header 以測試驗證
      delete content.header;

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Print content header is required");
    });

    it("items 缺少或為空陣列時應回傳警告", () => {
      const content = buildBasePrintContent({ items: [] });

      const result = PrintContentValidator.validate(content);

      // 空陣列是 warning 而非 error
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("No items found in print content");
    });

    it("items 為 undefined 時應回傳警告", () => {
      const content = buildBasePrintContent();
      // @ts-expect-error — 故意移除 items 以測試驗證
      delete content.items;

      const result = PrintContentValidator.validate(content);

      expect(result.warnings).toContain("No items found in print content");
    });

    it("缺少 summary 時應回傳錯誤", () => {
      const content = buildBasePrintContent();
      // @ts-expect-error — 故意移除 summary 以測試驗證
      delete content.summary;

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Print content summary is required");
    });

    it("缺少 footer 時應回傳錯誤", () => {
      const content = buildBasePrintContent();
      // @ts-expect-error — 故意移除 footer 以測試驗證
      delete content.footer;

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Print content footer is required");
    });
  });

  describe("validate — items 細項驗證", () => {
    it("item 缺少 name 時應回傳錯誤", () => {
      const content = buildBasePrintContent({
        items: [
          {
            name: "",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      });

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Item 1 is missing name");
    });

    it("item quantity 為負數時應回傳錯誤", () => {
      const content = buildBasePrintContent({
        items: [
          {
            name: "測試餐點",
            quantity: -1,
            unitPrice: 100,
            totalPrice: -100,
          },
        ],
      });

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Item 1 quantity must be positive");
    });

    it("item quantity 為零時應回傳錯誤", () => {
      const content = buildBasePrintContent({
        items: [
          {
            name: "測試餐點",
            quantity: 0,
            unitPrice: 100,
            totalPrice: 0,
          },
        ],
      });

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Item 1 quantity must be positive");
    });

    it("item unitPrice 為負數時應回傳錯誤", () => {
      const content = buildBasePrintContent({
        items: [
          {
            name: "測試餐點",
            quantity: 1,
            unitPrice: -50,
            totalPrice: -50,
          },
        ],
      });

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Item 1 unit price cannot be negative");
    });
  });

  describe("validate — summary 驗證", () => {
    it("summary total 為負數時應回傳錯誤", () => {
      const content = buildBasePrintContent();
      content.summary = {
        ...content.summary,
        total: -10,
      };

      const result = PrintContentValidator.validate(content);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Total amount cannot be negative");
    });
  });

  describe("validateForPrinter — 印表機特定驗證", () => {
    it("thermal 印表機列印超過 50 項時應回傳警告", () => {
      const manyItems = Array.from({ length: 51 }, (_, i) => ({
        name: `品項 ${i + 1}`,
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
      }));
      const content = buildBasePrintContent({ items: manyItems });

      const result = PrintContentValidator.validateForPrinter(
        content,
        "thermal",
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Many items may slow down thermal printing",
      );
    });

    it("thermal 印表機列印 50 項或以下時不應回傳警告", () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        name: `品項 ${i + 1}`,
        quantity: 1,
        unitPrice: 10,
        totalPrice: 10,
      }));
      const content = buildBasePrintContent({ items });

      const result = PrintContentValidator.validateForPrinter(
        content,
        "thermal",
      );

      expect(result.warnings).not.toContain(
        "Many items may slow down thermal printing",
      );
    });

    it("inkjet 印表機同時含 QR code 和 barcode 時應回傳警告", () => {
      const content = buildBasePrintContent();
      content.footer = {
        ...content.footer,
        qrCode: { data: "https://example.com", size: "medium" },
        barcode: { data: "123456789", format: "CODE128" },
      };

      const result = PrintContentValidator.validateForPrinter(
        content,
        "inkjet",
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Both QR code and barcode may slow down inkjet printing",
      );
    });

    it("dot_matrix 印表機含 logo 時應回傳警告", () => {
      const content = buildBasePrintContent();
      content.header = {
        ...content.header,
        logo: {
          type: "image",
          data: "base64logodata",
          alignment: "center",
        },
      };

      const result = PrintContentValidator.validateForPrinter(
        content,
        "dot_matrix",
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        "Logo printing not supported on dot matrix printers",
      );
    });

    it("validateForPrinter 也會包含基礎驗證的錯誤", () => {
      const content = buildBasePrintContent();
      // @ts-expect-error — 故意移除 header 以測試驗證
      delete content.header;

      const result = PrintContentValidator.validateForPrinter(
        content,
        "thermal",
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Print content header is required");
    });
  });
});
