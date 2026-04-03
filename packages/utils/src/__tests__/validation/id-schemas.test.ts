import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  restaurantIdSchema,
  numericIdSchema,
  numericIdParamSchema,
  restaurantIdParamSchema,
  optionalRestaurantIdSchema,
  optionalNumericIdSchema,
} from "../../validation/id-schemas";

describe("id-schemas", () => {
  const validUUID = "019469a0-0001-7000-8000-000000000001";

  describe("uuidSchema", () => {
    it("should accept a valid UUID", () => {
      expect(uuidSchema.parse(validUUID)).toBe(validUUID);
    });

    it("should reject non-UUID string", () => {
      expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    });

    it("should reject empty string", () => {
      expect(() => uuidSchema.parse("")).toThrow();
    });

    it("should accept UUID v4", () => {
      expect(() =>
        uuidSchema.parse("550e8400-e29b-41d4-a716-446655440000"),
      ).not.toThrow();
    });
  });

  describe("restaurantIdSchema", () => {
    it("should accept a valid UUID", () => {
      expect(restaurantIdSchema.parse(validUUID)).toBe(validUUID);
    });

    it("should reject invalid format", () => {
      expect(() => restaurantIdSchema.parse("123")).toThrow(
        /Invalid restaurant ID/,
      );
    });
  });

  describe("numericIdSchema", () => {
    it("should accept positive integers", () => {
      expect(numericIdSchema.parse(1)).toBe(1);
      expect(numericIdSchema.parse(999)).toBe(999);
    });

    it("should reject zero", () => {
      expect(() => numericIdSchema.parse(0)).toThrow();
    });

    it("should reject negative numbers", () => {
      expect(() => numericIdSchema.parse(-1)).toThrow();
    });

    it("should reject floats", () => {
      expect(() => numericIdSchema.parse(1.5)).toThrow();
    });
  });

  describe("numericIdParamSchema", () => {
    it("should transform numeric string to number", () => {
      expect(numericIdParamSchema.parse("123")).toBe(123);
    });

    it("should transform '1' to 1", () => {
      expect(numericIdParamSchema.parse("1")).toBe(1);
    });

    it("should reject non-numeric string", () => {
      expect(() => numericIdParamSchema.parse("abc")).toThrow();
    });

    it("should reject string with letters mixed", () => {
      expect(() => numericIdParamSchema.parse("12abc")).toThrow();
    });

    it("should reject empty string", () => {
      expect(() => numericIdParamSchema.parse("")).toThrow();
    });

    it("should reject negative numeric string", () => {
      expect(() => numericIdParamSchema.parse("-1")).toThrow();
    });
  });

  describe("restaurantIdParamSchema", () => {
    it("should accept valid UUID string", () => {
      expect(restaurantIdParamSchema.parse(validUUID)).toBe(validUUID);
    });

    it("should reject non-UUID", () => {
      expect(() => restaurantIdParamSchema.parse("123")).toThrow();
    });
  });

  describe("optionalRestaurantIdSchema", () => {
    it("should accept valid UUID", () => {
      expect(optionalRestaurantIdSchema.parse(validUUID)).toBe(validUUID);
    });

    it("should accept undefined", () => {
      expect(optionalRestaurantIdSchema.parse(undefined)).toBeUndefined();
    });

    it("should reject invalid UUID", () => {
      expect(() => optionalRestaurantIdSchema.parse("bad")).toThrow();
    });
  });

  describe("optionalNumericIdSchema", () => {
    it("should accept positive integer", () => {
      expect(optionalNumericIdSchema.parse(42)).toBe(42);
    });

    it("should accept undefined", () => {
      expect(optionalNumericIdSchema.parse(undefined)).toBeUndefined();
    });

    it("should reject zero", () => {
      expect(() => optionalNumericIdSchema.parse(0)).toThrow();
    });
  });
});
