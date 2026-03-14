// apps/api/src/features/seats/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import {
  batchCreateSeatsSchema,
  updateSeatSchema,
  occupySeatSchema,
  seatFilterSchema,
  idParamSchema,
  tableIdParamSchema,
  qrCodeParamSchema,
  tableIdQuerySchema,
  batchRegenerateQRSchema,
} from "../schemas/validation";

describe("Seats Validation Schemas", () => {
  // ─── batchCreateSeatsSchema ───────────────────────────────────────

  describe("batchCreateSeatsSchema", () => {
    it("should accept valid input with required fields only", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 4,
      });
      expect(result.success).toBe(true);
    });

    it("should apply default numberingStyle of 'numeric'", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 4,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.numberingStyle).toBe("numeric");
      }
    });

    it("should accept all valid numberingStyle values", () => {
      for (const style of ["numeric", "alphabetic", "custom"] as const) {
        const result = batchCreateSeatsSchema.safeParse({
          tableId: 1,
          seatCount: 2,
          numberingStyle: style,
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid numberingStyle enum value", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 2,
        numberingStyle: "roman",
      });
      expect(result.success).toBe(false);
    });

    it("should accept seatCount at minimum boundary (1)", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should accept seatCount at maximum boundary (100)", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 100,
      });
      expect(result.success).toBe(true);
    });

    it("should reject seatCount below minimum (0)", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject seatCount above maximum (101)", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 101,
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional customNumbers array", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 3,
        numberingStyle: "custom",
        customNumbers: ["A", "B", "C"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional prefix string within 10 chars", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 2,
        prefix: "S",
      });
      expect(result.success).toBe(true);
    });

    it("should reject prefix exceeding 10 characters", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1,
        seatCount: 2,
        prefix: "TOOLONGPFX1",
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer tableId", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: 1.5,
        seatCount: 2,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative tableId", () => {
      const result = batchCreateSeatsSchema.safeParse({
        tableId: -1,
        seatCount: 2,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing tableId", () => {
      const result = batchCreateSeatsSchema.safeParse({ seatCount: 2 });
      expect(result.success).toBe(false);
    });

    it("should reject missing seatCount", () => {
      const result = batchCreateSeatsSchema.safeParse({ tableId: 1 });
      expect(result.success).toBe(false);
    });
  });

  // ─── updateSeatSchema ─────────────────────────────────────────────

  describe("updateSeatSchema", () => {
    it("should accept empty object (all fields optional)", () => {
      const result = updateSeatSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept valid seatNumber", () => {
      const result = updateSeatSchema.safeParse({ seatNumber: "A1" });
      expect(result.success).toBe(true);
    });

    it("should reject seatNumber exceeding 50 chars", () => {
      const result = updateSeatSchema.safeParse({
        seatNumber: "A".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty seatNumber (min 1)", () => {
      const result = updateSeatSchema.safeParse({ seatNumber: "" });
      expect(result.success).toBe(false);
    });

    it("should accept valid seatName", () => {
      const result = updateSeatSchema.safeParse({ seatName: "Window Seat" });
      expect(result.success).toBe(true);
    });

    it("should reject seatName exceeding 100 chars", () => {
      const result = updateSeatSchema.safeParse({
        seatName: "X".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid position string", () => {
      const result = updateSeatSchema.safeParse({ position: "near-door" });
      expect(result.success).toBe(true);
    });

    it("should reject position exceeding 200 chars", () => {
      const result = updateSeatSchema.safeParse({
        position: "P".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("should accept boolean isActive", () => {
      const result = updateSeatSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it("should reject non-boolean isActive", () => {
      const result = updateSeatSchema.safeParse({ isActive: "yes" });
      expect(result.success).toBe(false);
    });
  });

  // ─── occupySeatSchema ─────────────────────────────────────────────

  describe("occupySeatSchema", () => {
    it("should accept valid orderId", () => {
      const result = occupySeatSchema.safeParse({ orderId: 42 });
      expect(result.success).toBe(true);
    });

    it("should accept orderId with optional occupiedBy", () => {
      const result = occupySeatSchema.safeParse({
        orderId: 42,
        occupiedBy: "John",
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-integer orderId", () => {
      const result = occupySeatSchema.safeParse({ orderId: 1.5 });
      expect(result.success).toBe(false);
    });

    it("should reject negative orderId", () => {
      const result = occupySeatSchema.safeParse({ orderId: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject missing orderId", () => {
      const result = occupySeatSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject occupiedBy exceeding 100 chars", () => {
      const result = occupySeatSchema.safeParse({
        orderId: 1,
        occupiedBy: "X".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── seatFilterSchema ─────────────────────────────────────────────

  describe("seatFilterSchema", () => {
    it("should accept valid required tableId string and transform to number", () => {
      const result = seatFilterSchema.safeParse({ tableId: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tableId).toBe(5);
      }
    });

    it("should transform isOccupied string 'true' to boolean true", () => {
      const result = seatFilterSchema.safeParse({
        tableId: "1",
        isOccupied: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isOccupied).toBe(true);
      }
    });

    it("should transform isOccupied string 'false' to boolean false", () => {
      const result = seatFilterSchema.safeParse({
        tableId: "1",
        isOccupied: "false",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isOccupied).toBe(false);
      }
    });

    it("should transform isActive string to boolean", () => {
      const result = seatFilterSchema.safeParse({
        tableId: "1",
        isActive: "true",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("should transform seatNumbers CSV string to array", () => {
      const result = seatFilterSchema.safeParse({
        tableId: "1",
        seatNumbers: "A1,A2,A3",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.seatNumbers).toEqual(["A1", "A2", "A3"]);
      }
    });

    it("should apply defaults page=1 and limit=50", () => {
      const result = seatFilterSchema.safeParse({ tableId: "1" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    it("should accept custom page and limit values", () => {
      const result = seatFilterSchema.safeParse({
        tableId: "1",
        page: "2",
        limit: "10",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it("should reject non-numeric tableId", () => {
      const result = seatFilterSchema.safeParse({ tableId: "abc" });
      expect(result.success).toBe(false);
    });

    it("should reject missing tableId", () => {
      const result = seatFilterSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── idParamSchema ────────────────────────────────────────────────

  describe("idParamSchema", () => {
    it("should accept numeric string id", () => {
      const result = idParamSchema.safeParse({ id: "42" });
      expect(result.success).toBe(true);
    });

    it("should reject non-numeric id", () => {
      const result = idParamSchema.safeParse({ id: "abc" });
      expect(result.success).toBe(false);
    });

    it("should reject missing id", () => {
      const result = idParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── tableIdParamSchema ───────────────────────────────────────────

  describe("tableIdParamSchema", () => {
    it("should accept numeric tableId string and transform to number", () => {
      const result = tableIdParamSchema.safeParse({ tableId: "10" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tableId).toBe(10);
      }
    });

    it("should reject non-numeric tableId", () => {
      const result = tableIdParamSchema.safeParse({ tableId: "xyz" });
      expect(result.success).toBe(false);
    });
  });

  // ─── qrCodeParamSchema ────────────────────────────────────────────

  describe("qrCodeParamSchema", () => {
    it("should accept any non-empty qrCode string", () => {
      const result = qrCodeParamSchema.safeParse({
        qrCode: "QR-TABLE-1-SEAT-3",
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty qrCode string (no min constraint)", () => {
      const result = qrCodeParamSchema.safeParse({ qrCode: "" });
      expect(result.success).toBe(true);
    });

    it("should reject missing qrCode", () => {
      const result = qrCodeParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── tableIdQuerySchema ───────────────────────────────────────────

  describe("tableIdQuerySchema", () => {
    it("should accept valid numeric tableId string and transform to number", () => {
      const result = tableIdQuerySchema.safeParse({ tableId: "7" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tableId).toBe(7);
      }
    });

    it("should reject non-numeric tableId", () => {
      const result = tableIdQuerySchema.safeParse({ tableId: "bad" });
      expect(result.success).toBe(false);
    });

    it("should reject missing tableId", () => {
      const result = tableIdQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── batchRegenerateQRSchema ──────────────────────────────────────

  describe("batchRegenerateQRSchema", () => {
    it("should accept valid positive integer tableId", () => {
      const result = batchRegenerateQRSchema.safeParse({ tableId: 3 });
      expect(result.success).toBe(true);
    });

    it("should reject non-integer tableId", () => {
      const result = batchRegenerateQRSchema.safeParse({ tableId: 1.5 });
      expect(result.success).toBe(false);
    });

    it("should reject negative tableId", () => {
      const result = batchRegenerateQRSchema.safeParse({ tableId: -5 });
      expect(result.success).toBe(false);
    });

    it("should reject missing tableId", () => {
      const result = batchRegenerateQRSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
