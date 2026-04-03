import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  getCurrencySymbol,
  getCurrencyConfig,
  CURRENCY_CONFIGS,
  DEFAULT_CURRENCY,
  type CurrencyCode,
} from "../currency";

describe("currency", () => {
  describe("CURRENCY_CONFIGS", () => {
    it("should have configs for TWD, MYR, VND", () => {
      expect(CURRENCY_CONFIGS).toHaveProperty("TWD");
      expect(CURRENCY_CONFIGS).toHaveProperty("MYR");
      expect(CURRENCY_CONFIGS).toHaveProperty("VND");
    });

    it("should default to TWD", () => {
      expect(DEFAULT_CURRENCY).toBe("TWD");
    });
  });

  describe("formatCurrency", () => {
    it("should format TWD without decimals, symbol before, no space", () => {
      const result = formatCurrency(350, "TWD");
      expect(result).toBe("NT$350");
    });

    it("should format MYR with 2 decimals, symbol before, with space", () => {
      const result = formatCurrency(12.5, "MYR");
      expect(result).toBe("RM 12.50");
    });

    it("should format VND without decimals, symbol after, with space", () => {
      const result = formatCurrency(100000, "VND");
      // VND uses locale vi-VN which adds thousand separators
      expect(result).toContain("₫");
      expect(result).toMatch(/[\d.]+\s₫$/);
    });

    it("should default to TWD when no currency specified", () => {
      const result = formatCurrency(100);
      expect(result).toBe("NT$100");
    });

    it("should handle zero amount", () => {
      expect(formatCurrency(0, "TWD")).toBe("NT$0");
      expect(formatCurrency(0, "MYR")).toBe("RM 0.00");
    });

    it("should handle large amounts with locale-specific grouping", () => {
      const result = formatCurrency(1000000, "TWD");
      expect(result).toContain("NT$");
      // Should contain the number (may have commas for grouping)
      expect(result).toMatch(/NT\$[\d,]+/);
    });

    it("should handle negative amounts", () => {
      const result = formatCurrency(-50, "TWD");
      expect(result).toContain("50");
      expect(result).toContain("NT$");
    });

    it("should return raw number string for unknown currency", () => {
      const result = formatCurrency(100, "UNKNOWN" as CurrencyCode);
      expect(result).toBe("100");
    });
  });

  describe("getCurrencySymbol", () => {
    it("should return NT$ for TWD", () => {
      expect(getCurrencySymbol("TWD")).toBe("NT$");
    });

    it("should return RM for MYR", () => {
      expect(getCurrencySymbol("MYR")).toBe("RM");
    });

    it("should return ₫ for VND", () => {
      expect(getCurrencySymbol("VND")).toBe("₫");
    });

    it("should default to TWD symbol", () => {
      expect(getCurrencySymbol()).toBe("NT$");
    });

    it("should return the currency code for unknown currency", () => {
      expect(getCurrencySymbol("UNKNOWN" as CurrencyCode)).toBe("UNKNOWN");
    });
  });

  describe("getCurrencyConfig", () => {
    it("should return full config for TWD", () => {
      const config = getCurrencyConfig("TWD");
      expect(config).toEqual({
        symbol: "NT$",
        position: "before",
        space: false,
        decimals: 0,
        locale: "zh-TW",
      });
    });

    it("should return full config for MYR", () => {
      const config = getCurrencyConfig("MYR");
      expect(config).toEqual({
        symbol: "RM",
        position: "before",
        space: true,
        decimals: 2,
        locale: "ms-MY",
      });
    });

    it("should return full config for VND", () => {
      const config = getCurrencyConfig("VND");
      expect(config).toEqual({
        symbol: "₫",
        position: "after",
        space: true,
        decimals: 0,
        locale: "vi-VN",
      });
    });

    it("should default to TWD config", () => {
      expect(getCurrencyConfig()).toEqual(getCurrencyConfig("TWD"));
    });

    it("should return undefined for unknown currency", () => {
      expect(getCurrencyConfig("UNKNOWN" as CurrencyCode)).toBeUndefined();
    });
  });
});
