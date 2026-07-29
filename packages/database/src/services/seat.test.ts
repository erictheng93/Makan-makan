import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { restaurants, seats, tables } from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { SeatService } from "./seat";
import { TableService } from "./table";

const restaurantId = "seat-service-restaurant";
const signingKey = "seat-service-test-signing-key-32-bytes";

describe("SeatService.createSeatsForTable", () => {
  let testDb: TestDatabase;
  let tableId: number;

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
      name: "Seat Service Restaurant",
      type: "restaurant",
      category: "casual",
      address: "1 Seat St",
      district: "Central",
      city: "Taipei",
      phone: "0200000000",
      settings: {},
      isAvailable: true,
      isActive: true,
      createdAt: new Date("2026-07-29T00:00:00.000Z"),
      updatedAt: new Date("2026-07-29T00:00:00.000Z"),
    } as never);
    const [table] = await testDb.drizzle
      .insert(tables)
      .values({
        restaurantId,
        number: "A1",
        capacity: 4,
        qrCode: "table-qr-a1",
        qrMode: "seat",
        seatCount: 2,
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      })
      .returning({ id: tables.id });
    tableId = table.id;
  });

  it("rejects a second batch when the table already has seats", async () => {
    const service = createService(testDb);
    await service.createSeatsForTable(tableId, 2);

    await expect(service.createSeatsForTable(tableId, 2)).rejects.toThrow(
      "Table already has seats",
    );
  });

  it("requires one unique custom number per requested seat", async () => {
    const service = createService(testDb);

    await expect(
      service.createSeatsForTable(tableId, 2, {
        numberingStyle: "custom",
      }),
    ).rejects.toThrow("Custom seat numbers must match seat count");
    await expect(
      service.createSeatsForTable(tableId, 2, {
        numberingStyle: "custom",
        customNumbers: ["Window", "Window"],
      }),
    ).rejects.toThrow("Custom seat numbers must be unique");
  });

  it("creates a seat-mode table and its configured seats through one service call", async () => {
    const service = createTableService(testDb);

    const createdTable = await service.createTable({
      restaurantId,
      number: "B1",
      capacity: 4,
      qrMode: "seat",
      seatCount: 4,
      seatNumberingStyle: "alphabetic",
    });
    const createdSeats = await testDb.drizzle
      .select({ seatNumber: seats.seatNumber })
      .from(seats)
      .where(eq(seats.tableId, createdTable.id))
      .orderBy(asc(seats.seatNumber));
    const listedTables = await service.getRestaurantTables(restaurantId);

    expect(createdTable).toMatchObject({
      qrMode: "seat",
      seatCount: 4,
      seatNumberingStyle: "alphabetic",
    });
    expect(createdSeats).toEqual([
      { seatNumber: "A" },
      { seatNumber: "B" },
      { seatNumber: "C" },
      { seatNumber: "D" },
    ]);
    expect(listedTables.tables).toContainEqual(
      expect.objectContaining({
        id: createdTable.id,
        qrMode: "seat",
        seatCount: 4,
        seatNumberingStyle: "alphabetic",
      }),
    );
  });

  it("switches an existing table to seat mode when table settings are updated", async () => {
    const service = createTableService(testDb);
    const createdTable = await service.createTable({
      restaurantId,
      number: "B2",
      capacity: 2,
    });

    const updatedTable = await service.updateTable(createdTable.id, {
      qrMode: "seat",
      seatCount: 2,
      seatNumberingStyle: "numeric",
    });
    const createdSeats = await testDb.drizzle
      .select({ seatNumber: seats.seatNumber })
      .from(seats)
      .where(eq(seats.tableId, createdTable.id))
      .orderBy(asc(seats.seatNumber));

    expect(updatedTable).toMatchObject({ qrMode: "seat", seatCount: 2 });
    expect(createdSeats).toEqual([{ seatNumber: "01" }, { seatNumber: "02" }]);
  });

  it("enforces unique seat numbers at the database boundary", async () => {
    const service = createService(testDb);
    await service.createSeatsForTable(tableId, 1);

    await expect(
      testDb.drizzle.insert(seats).values({
        tableId,
        seatNumber: "01",
        qrCode: "unique-duplicate-test-qr",
      }),
    ).rejects.toThrow();

    const persistedSeats = await testDb.drizzle
      .select({ id: seats.id })
      .from(seats)
      .where(eq(seats.tableId, tableId));
    expect(persistedSeats).toHaveLength(1);
  });
});

function createService(testDb: TestDatabase) {
  return new SeatService(testDb.bindings.DB, {
    JWT_SECRET: "test",
    QR_SIGNING_KEY: signingKey,
    CLIENT_BASE_URL: "https://example.test",
  });
}

function createTableService(testDb: TestDatabase) {
  return new TableService(testDb.bindings.DB, {
    JWT_SECRET: "test",
    QR_SIGNING_KEY: signingKey,
    CLIENT_BASE_URL: "https://example.test",
  });
}
