// apps/api/src/features/tables/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import {
  tableFeaturesSchema,
  createTableSchema,
  updateTableSchema,
  tableFilterSchema,
  occupyTableSchema,
  cleanTableSchema,
  regenerateQRSchema,
  qrCodeOptionsSchema,
  generateQRBulkSchema,
  availableTablesQuerySchema,
  tableStatsQuerySchema,
  qrCodeParamSchema,
  idParamSchema,
} from "../schemas/validation";

describe("Tables Validation Schemas", () => {
  // ─── tableFeaturesSchema ──────────────────────────────────────────

  describe("tableFeaturesSchema", () => {
    it("should accept a valid features object with all fields", () => {
      const result = tableFeaturesSchema.safeParse({
        hasChargingPort: true,
        hasWifi: true,
        isAccessible: false,
        hasView: true,
        isQuietZone: false,
        smokingAllowed: false,
      });
      expect(result.success).toBe(true);
    });

    it("should accept a partial features object", () => {
      const result = tableFeaturesSchema.safeParse({
        hasWifi: true,
        isAccessible: true,
      });
      expect(result.success).toBe(true);
    });

    it("should accept undefined (schema is optional)", () => {
      const result = tableFeaturesSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should reject non-boolean feature values", () => {
      const result = tableFeaturesSchema.safeParse({
        hasChargingPort: "yes",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── createTableSchema ────────────────────────────────────────────

  describe("createTableSchema", () => {
    it("should accept valid input with required fields only", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
        capacity: 4,
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid input with all fields", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
        name: "Window Table",
        capacity: 6,
        location: "Near entrance",
        floor: 2,
        section: "VIP",
        features: { hasWifi: true, hasView: true },
        isReservable: false,
      });
      expect(result.success).toBe(true);
    });

    it("should apply default floor=1 when not provided", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
        capacity: 4,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.floor).toBe(1);
      }
    });

    it("should apply default isReservable=true when not provided", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
        capacity: 4,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isReservable).toBe(true);
      }
    });

    it("should accept number at max length (50 chars)", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T".repeat(50),
        capacity: 2,
      });
      expect(result.success).toBe(true);
    });

    it("should reject number exceeding 50 chars", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T".repeat(51),
        capacity: 2,
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty number string (min 1)", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "",
        capacity: 2,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-positive capacity (0)", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
        capacity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer capacity", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
        capacity: 2.5,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing required field restaurantId", () => {
      const result = createTableSchema.safeParse({
        number: "T1",
        capacity: 4,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing required field number", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        capacity: 4,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing required field capacity", () => {
      const result = createTableSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        number: "T1",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── updateTableSchema ────────────────────────────────────────────

  describe("updateTableSchema", () => {
    it("should accept empty object (all fields optional)", () => {
      const result = updateTableSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept valid partial update", () => {
      const result = updateTableSchema.safeParse({
        number: "T2",
        capacity: 8,
        isActive: false,
      });
      expect(result.success).toBe(true);
    });

    it("should accept name at max length (50 chars)", () => {
      const result = updateTableSchema.safeParse({
        name: "N".repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it("should reject name exceeding 50 chars", () => {
      const result = updateTableSchema.safeParse({
        name: "N".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it("should accept location at max length (100 chars)", () => {
      const result = updateTableSchema.safeParse({
        location: "L".repeat(100),
      });
      expect(result.success).toBe(true);
    });

    it("should reject location exceeding 100 chars", () => {
      const result = updateTableSchema.safeParse({
        location: "L".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should accept maintenanceNotes at max length (500 chars)", () => {
      const result = updateTableSchema.safeParse({
        maintenanceNotes: "M".repeat(500),
      });
      expect(result.success).toBe(true);
    });

    it("should reject maintenanceNotes exceeding 500 chars", () => {
      const result = updateTableSchema.safeParse({
        maintenanceNotes: "M".repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-boolean isActive", () => {
      const result = updateTableSchema.safeParse({ isActive: "yes" });
      expect(result.success).toBe(false);
    });

    it("should reject non-positive floor (0)", () => {
      const result = updateTableSchema.safeParse({ floor: 0 });
      expect(result.success).toBe(false);
    });
  });

  // ─── tableFilterSchema ────────────────────────────────────────────

  describe("tableFilterSchema", () => {
    it("should apply defaults page=1 and limit=20 when not provided", () => {
      const result = tableFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it("should accept restaurantId as string (UUID)", () => {
      const result = tableFilterSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(
          "019469a0-0001-7000-8000-000000000001",
        );
      }
    });

    it("should transform floor string to number", () => {
      const result = tableFilterSchema.safeParse({ floor: "3" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.floor).toBe(3);
      }
    });

    it("should transform minCapacity and maxCapacity strings to numbers", () => {
      const result = tableFilterSchema.safeParse({
        minCapacity: "2",
        maxCapacity: "10",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minCapacity).toBe(2);
        expect(result.data.maxCapacity).toBe(10);
      }
    });

    it("should transform isOccupied 'true' to boolean true", () => {
      const result = tableFilterSchema.safeParse({ isOccupied: "true" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isOccupied).toBe(true);
      }
    });

    it("should transform isOccupied 'false' to boolean false", () => {
      const result = tableFilterSchema.safeParse({ isOccupied: "false" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isOccupied).toBe(false);
      }
    });

    it("should transform isActive and isReservable strings to booleans", () => {
      const result = tableFilterSchema.safeParse({
        isActive: "true",
        isReservable: "false",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
        expect(result.data.isReservable).toBe(false);
      }
    });

    it("should accept custom page and limit values", () => {
      const result = tableFilterSchema.safeParse({
        page: "3",
        limit: "50",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it("should accept optional search string", () => {
      const result = tableFilterSchema.safeParse({ search: "VIP" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe("VIP");
      }
    });

    it("should accept any non-empty restaurantId string", () => {
      const result = tableFilterSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject non-numeric floor string", () => {
      const result = tableFilterSchema.safeParse({ floor: "ground" });
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric page string", () => {
      const result = tableFilterSchema.safeParse({ page: "first" });
      expect(result.success).toBe(false);
    });
  });

  // ─── occupyTableSchema ────────────────────────────────────────────

  describe("occupyTableSchema", () => {
    it("should accept valid orderId with optional fields", () => {
      const result = occupyTableSchema.safeParse({
        orderId: 42,
        occupiedBy: "John",
        estimatedMinutes: 60,
      });
      expect(result.success).toBe(true);
    });

    it("should accept orderId only (optional fields omitted)", () => {
      const result = occupyTableSchema.safeParse({ orderId: 1 });
      expect(result.success).toBe(true);
    });

    it("should reject non-integer orderId", () => {
      const result = occupyTableSchema.safeParse({ orderId: 1.5 });
      expect(result.success).toBe(false);
    });

    it("should reject negative orderId", () => {
      const result = occupyTableSchema.safeParse({ orderId: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject missing orderId", () => {
      const result = occupyTableSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject occupiedBy exceeding 100 chars", () => {
      const result = occupyTableSchema.safeParse({
        orderId: 1,
        occupiedBy: "X".repeat(101),
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-positive estimatedMinutes (0)", () => {
      const result = occupyTableSchema.safeParse({
        orderId: 1,
        estimatedMinutes: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── cleanTableSchema ─────────────────────────────────────────────

  describe("cleanTableSchema", () => {
    it("should accept empty object (notes is optional)", () => {
      const result = cleanTableSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept valid notes string", () => {
      const result = cleanTableSchema.safeParse({
        notes: "Deep clean required",
      });
      expect(result.success).toBe(true);
    });

    it("should reject notes exceeding 200 chars", () => {
      const result = cleanTableSchema.safeParse({
        notes: "N".repeat(201),
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── regenerateQRSchema ───────────────────────────────────────────

  describe("regenerateQRSchema", () => {
    it("should accept empty object (customData is optional)", () => {
      const result = regenerateQRSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept object with customData of any type", () => {
      const result = regenerateQRSchema.safeParse({
        customData: { color: "red", label: "Premium" },
      });
      expect(result.success).toBe(true);
    });
  });

  // ─── qrCodeOptionsSchema ──────────────────────────────────────────

  describe("qrCodeOptionsSchema", () => {
    it("should accept undefined (schema is optional)", () => {
      const result = qrCodeOptionsSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should apply defaults for size, format, and includeTableInfo", () => {
      const result = qrCodeOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data!.size).toBe("medium");
        expect(result.data!.format).toBe("png");
        expect(result.data!.includeTableInfo).toBe(true);
      }
    });

    it("should accept all valid size enum values", () => {
      for (const size of ["small", "medium", "large"] as const) {
        const result = qrCodeOptionsSchema.safeParse({ size });
        expect(result.success).toBe(true);
      }
    });

    it("should accept all valid format enum values", () => {
      for (const format of ["png", "svg", "pdf"] as const) {
        const result = qrCodeOptionsSchema.safeParse({ format });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid size enum value", () => {
      const result = qrCodeOptionsSchema.safeParse({ size: "xlarge" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid format enum value", () => {
      const result = qrCodeOptionsSchema.safeParse({ format: "jpeg" });
      expect(result.success).toBe(false);
    });
  });

  // ─── generateQRBulkSchema ─────────────────────────────────────────

  describe("generateQRBulkSchema", () => {
    it("should accept valid input with required fields", () => {
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds: [1, 2, 3],
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid input with options", () => {
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds: [1],
        options: { size: "large", format: "svg", includeTableInfo: false },
      });
      expect(result.success).toBe(true);
    });

    it("should accept tableIds at minimum length (1 item)", () => {
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds: [5],
      });
      expect(result.success).toBe(true);
    });

    it("should accept tableIds at maximum length (50 items)", () => {
      const tableIds = Array.from({ length: 50 }, (_, i) => i + 1);
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty tableIds array", () => {
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject tableIds exceeding 50 items", () => {
      const tableIds = Array.from({ length: 51 }, (_, i) => i + 1);
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds,
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing restaurantId", () => {
      const result = generateQRBulkSchema.safeParse({
        tableIds: [1],
      });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer values in tableIds", () => {
      const result = generateQRBulkSchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        tableIds: [1, 2.5, 3],
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── availableTablesQuerySchema ───────────────────────────────────

  describe("availableTablesQuerySchema", () => {
    it("should accept valid restaurantId as UUID string", () => {
      const result = availableTablesQuerySchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000007",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(
          "019469a0-0001-7000-8000-000000000007",
        );
      }
    });

    it("should accept optional capacity and transform to number", () => {
      const result = availableTablesQuerySchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
        capacity: "4",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capacity).toBe(4);
      }
    });

    it("should accept any string restaurantId", () => {
      const result = availableTablesQuerySchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing restaurantId", () => {
      const result = availableTablesQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── tableStatsQuerySchema ────────────────────────────────────────

  describe("tableStatsQuerySchema", () => {
    it("should accept valid restaurantId as UUID string", () => {
      const result = tableStatsQuerySchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000015",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.restaurantId).toBe(
          "019469a0-0001-7000-8000-000000000015",
        );
      }
    });

    it("should accept any string restaurantId", () => {
      const result = tableStatsQuerySchema.safeParse({
        restaurantId: "019469a0-0001-7000-8000-000000000001",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing restaurantId", () => {
      const result = tableStatsQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── qrCodeParamSchema ────────────────────────────────────────────

  describe("qrCodeParamSchema", () => {
    it("should accept any qrCode string", () => {
      const result = qrCodeParamSchema.safeParse({
        qrCode: "QR-TABLE-1-ABC123",
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

  // ─── idParamSchema ────────────────────────────────────────────────

  describe("idParamSchema", () => {
    it("should accept numeric string and transform to number", () => {
      const result = idParamSchema.safeParse({ id: "42" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(42);
      }
    });

    it("should reject non-numeric id string", () => {
      const result = idParamSchema.safeParse({ id: "abc" });
      expect(result.success).toBe(false);
    });

    it("should reject missing id", () => {
      const result = idParamSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
