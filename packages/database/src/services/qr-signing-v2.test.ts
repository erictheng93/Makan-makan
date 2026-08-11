import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { parseSignedQRUrl } from "@makanmasak/utils";
import { restaurants, seats } from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { TableService } from "./table";

const restaurantId = "qr-v2-restaurant";
const signingKey = "qr-v2-test-signing-key-at-least-32-characters";

describe("table and seat QR v2 generation", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
    await testDb.drizzle.insert(restaurants).values({
      id: restaurantId,
      name: "QR V2 Restaurant",
      type: "restaurant",
      category: "casual",
      address: "1 QR Street",
      district: "Central",
      city: "Taipei",
      phone: "0200000000",
      settings: {},
      isAvailable: true,
      isActive: true,
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-29T00:00:00.000Z"),
    } as never);
  });

  it("emits table-bound v2 URLs for tables and seats", async () => {
    const service = new TableService(testDb.bindings.DB, {
      JWT_SECRET: "test",
      QR_SIGNING_KEY: signingKey,
      CLIENT_BASE_URL: "https://example.test",
    });

    const tableOne = await service.createTable({
      restaurantId,
      number: "A1",
      capacity: 1,
      qrMode: "seat",
      seatCount: 1,
    });
    const tableTwo = await service.createTable({
      restaurantId,
      number: "B1",
      capacity: 1,
      qrMode: "seat",
      seatCount: 1,
    });
    const [seatOne] = await testDb.drizzle
      .select({ qrCode: seats.qrCode })
      .from(seats)
      .where(eq(seats.tableId, tableOne.id));
    const [seatTwo] = await testDb.drizzle
      .select({ qrCode: seats.qrCode })
      .from(seats)
      .where(eq(seats.tableId, tableTwo.id));

    expect(parseSignedQRUrl(tableOne.qrCode)).toMatchObject({
      formatVersion: 2,
      tableId: tableOne.id,
      type: "table",
    });
    expect(parseSignedQRUrl(tableTwo.qrCode)).toMatchObject({
      formatVersion: 2,
      tableId: tableTwo.id,
      type: "table",
    });
    expect(parseSignedQRUrl(seatOne.qrCode)).toMatchObject({
      formatVersion: 2,
      tableId: tableOne.id,
      type: "seat",
      identifier: "01",
    });
    expect(parseSignedQRUrl(seatTwo.qrCode)).toMatchObject({
      formatVersion: 2,
      tableId: tableTwo.id,
      type: "seat",
      identifier: "01",
    });
    expect(parseSignedQRUrl(seatOne.qrCode)?.signature).not.toBe(
      parseSignedQRUrl(seatTwo.qrCode)?.signature,
    );
  });

  it("leaves an unsignable placeholder when the post-insert v2 upgrade fails", async () => {
    const service = new TableService(testDb.bindings.DB, {
      JWT_SECRET: "test",
      QR_SIGNING_KEY: signingKey,
      CLIENT_BASE_URL: "https://example.test",
    });
    const legacyRow = {
      id: 91,
      restaurantId,
      number: "FALLBACK-1",
      capacity: 2,
      qrCode: "",
      qrCodeVersion: 1,
      qrMode: "table",
      seatCount: 0,
    };
    const selectQuery = {
      from: () => ({
        where: () => ({ get: async () => undefined }),
      }),
    };
    const insertQuery = {
      values: (values: { qrCode: string }) => ({
        returning: async () => [{ ...legacyRow, qrCode: values.qrCode }],
      }),
    };
    const updateQuery = {
      set: () => ({
        where: async () => {
          throw new Error("simulated D1 update failure");
        },
      }),
    };

    (service as unknown as { db: unknown }).db = {
      select: () => selectQuery,
      insert: () => insertQuery,
      update: () => updateQuery,
    };

    const created = await service.createTable({
      restaurantId,
      number: legacyRow.number,
      capacity: legacyRow.capacity,
    });

    expect(created.id).toBe(legacyRow.id);
    // Previously this fell back to a valid v1 signature. That is worse than a
    // broken one once phase 3 stops accepting v1: the sticker would scan and
    // then be rejected, leaving a customer unable to order with nothing to
    // explain why. A placeholder is visibly unusable and audit-qr-format flags
    // it as unparseable.
    expect(created.qrCode).toMatch(/^pending:/);
    expect(parseSignedQRUrl(created.qrCode)).toBeNull();
  });
});
