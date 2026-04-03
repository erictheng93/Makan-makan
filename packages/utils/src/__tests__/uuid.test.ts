import { describe, it, expect } from "vitest";
import { generateUUID, isValidUUID, extractUUIDTimestamp } from "../uuid";

describe("uuid", () => {
  describe("generateUUID", () => {
    it("should return a valid UUID format", () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("should return unique values across calls", () => {
      const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
      expect(uuids.size).toBe(100);
    });

    it("should generate UUID v7 (version nibble = 7)", () => {
      const uuid = generateUUID();
      // UUID v7: the 13th hex char (position 14 in string with dashes) should be '7'
      expect(uuid[14]).toBe("7");
    });
  });

  describe("isValidUUID", () => {
    it("should accept a valid UUID v7", () => {
      const uuid = generateUUID();
      expect(isValidUUID(uuid)).toBe(true);
    });

    it("should accept a valid UUID v4", () => {
      expect(
        isValidUUID("550e8400-e29b-41d4-a716-446655440000"),
      ).toBe(true);
    });

    it("should accept uppercase UUIDs", () => {
      expect(
        isValidUUID("550E8400-E29B-41D4-A716-446655440000"),
      ).toBe(true);
    });

    it("should reject empty string", () => {
      expect(isValidUUID("")).toBe(false);
    });

    it("should reject non-hex characters", () => {
      expect(
        isValidUUID("zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"),
      ).toBe(false);
    });

    it("should reject wrong length", () => {
      expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
    });

    it("should reject missing dashes", () => {
      expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false);
    });

    it("should reject random strings", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
    });
  });

  describe("extractUUIDTimestamp", () => {
    it("should extract a recent timestamp from a freshly generated UUID v7", () => {
      const before = Date.now();
      const uuid = generateUUID();
      const after = Date.now();
      const timestamp = extractUUIDTimestamp(uuid);

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp!.getTime()).toBeGreaterThanOrEqual(before);
      expect(timestamp!.getTime()).toBeLessThanOrEqual(after);
    });

    it("should return null for an invalid UUID", () => {
      expect(extractUUIDTimestamp("not-a-uuid")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(extractUUIDTimestamp("")).toBeNull();
    });

    it("should return a Date for a valid UUID v4 (timestamp may not be meaningful)", () => {
      const result = extractUUIDTimestamp(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(result).toBeInstanceOf(Date);
    });
  });
});
