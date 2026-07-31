import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { orders, restaurants, seats, tables } from "../schema";
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

  it("creates a table with a v2 QR and never persists a legacy one", async () => {
    const service = createTableService(testDb);

    const createdTable = await service.createTable({
      restaurantId,
      number: "V2-1",
      capacity: 4,
    });

    const [row] = await testDb.drizzle
      .select({ qrCode: tables.qrCode, qrCodeVersion: tables.qrCodeVersion })
      .from(tables)
      .where(eq(tables.id, createdTable.id));

    // createTable inserts a placeholder before it can sign (the signature binds
    // the auto-increment id), so assert the row does not keep it, and that what
    // it does keep is v2 rather than a legacy signature that the phase 3 cutoff
    // would later reject.
    expect(row.qrCode).not.toMatch(/^pending:/);
    expect(row.qrCode).toContain("f=2");
    expect(row.qrCode).toContain(`d=${createdTable.id}`);
    expect(row.qrCode).toContain("n=V2-1");
    expect(row.qrCodeVersion).toBe(1);
    // The returned object must agree with what was stored, or callers print a
    // QR that differs from the one the DB will verify.
    expect(createdTable.qrCode).toBe(row.qrCode);
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

  it("allows only the first caller to occupy an available seat", async () => {
    const service = createService(testDb);
    const [createdSeat] = await service.createSeatsForTable(tableId, 1);
    await testDb.drizzle.insert(orders).values({
      id: "seat-order-1",
      restaurantId,
      tableId,
      orderNumber: "SEAT-ORDER-1",
    });
    await testDb.drizzle.insert(orders).values({
      id: "seat-order-2",
      restaurantId,
      tableId,
      orderNumber: "SEAT-ORDER-2",
    });

    await expect(
      service.occupySeat(createdSeat.id, "seat-order-1", "first"),
    ).resolves.toBe(true);
    await expect(
      service.occupySeat(createdSeat.id, "seat-order-2", "second"),
    ).resolves.toBe(false);

    const persistedSeat = await testDb.drizzle
      .select({
        currentOrderId: seats.currentOrderId,
        occupiedBy: seats.occupiedBy,
      })
      .from(seats)
      .where(eq(seats.id, createdSeat.id))
      .get();
    expect(persistedSeat).toEqual({
      currentOrderId: "seat-order-1",
      occupiedBy: "first",
    });
  });

  it("allows only the first caller to occupy an available table", async () => {
    const service = createTableService(testDb);

    await expect(service.occupyTable(tableId, null, "first")).resolves.toBe(
      true,
    );
    await expect(service.occupyTable(tableId, null, "second")).resolves.toBe(
      false,
    );

    const persistedTable = await testDb.drizzle
      .select({ occupiedBy: tables.occupiedBy })
      .from(tables)
      .where(eq(tables.id, tableId))
      .get();
    expect(persistedTable?.occupiedBy).toBe("first");
  });

  it("increments usage once when an occupied seat is released", async () => {
    const service = createService(testDb);
    const [createdSeat] = await service.createSeatsForTable(tableId, 1);
    await testDb.drizzle
      .update(seats)
      .set({ isOccupied: true, totalUsage: 4 })
      .where(eq(seats.id, createdSeat.id));

    await expect(service.releaseSeat(createdSeat.id)).resolves.toBe(true);
    await expect(service.releaseSeat(createdSeat.id)).resolves.toBe(false);

    const persistedSeat = await testDb.drizzle
      .select({
        isOccupied: seats.isOccupied,
        totalUsage: seats.totalUsage,
      })
      .from(seats)
      .where(eq(seats.id, createdSeat.id))
      .get();
    expect(persistedSeat).toEqual({ isOccupied: false, totalUsage: 5 });
  });

  it("hides soft-deleted and inactive seats from public lookups", async () => {
    const service = createService(testDb);
    const [deletedSeat, inactiveSeat] = await service.createSeatsForTable(
      tableId,
      2,
    );

    await expect(service.deleteSeat(deletedSeat.id)).resolves.toBe(true);
    await service.updateSeat(inactiveSeat.id, { isActive: false });

    const deletedRow = await testDb.drizzle
      .select({
        isActive: seats.isActive,
        deletedAt: seats.deletedAt,
      })
      .from(seats)
      .where(eq(seats.id, deletedSeat.id))
      .get();
    expect(deletedRow?.isActive).toBe(false);
    expect(deletedRow?.deletedAt).toBeInstanceOf(Date);

    await expect(service.getSeatById(deletedSeat.id)).resolves.toBeUndefined();
    await expect(
      service.getSeatByQRCode(deletedSeat.qrCode),
    ).resolves.toBeUndefined();
    await expect(
      service.getSeatByQRCode(inactiveSeat.qrCode),
    ).resolves.toBeUndefined();

    const listedSeats = await service.getSeatsByTableId(tableId);
    expect(listedSeats.seats).toEqual([
      expect.objectContaining({ id: inactiveSeat.id, isActive: false }),
    ]);
    expect(listedSeats.total).toBe(1);

    const stats = await service.getSeatStats(tableId);
    expect(stats).toMatchObject({
      totalSeats: 1,
      occupiedSeats: 0,
      availableSeats: 0,
      inactiveSeats: 1,
    });
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

describe("SeatService.batchGenerateSeatQRCodes", () => {
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
        capacity: 8,
        qrCode: "table-qr-a1",
        qrMode: "seat",
        seatCount: 6,
        createdAt: new Date("2026-07-29T00:00:00.000Z"),
        updatedAt: new Date("2026-07-29T00:00:00.000Z"),
      })
      .returning({ id: tables.id });
    tableId = table.id;
  });

  it("advances every seat together, with each QR bound to its own seat", async () => {
    const service = createService(testDb);
    await service.createSeatsForTable(tableId, 6);

    const before = await testDb.drizzle
      .select({
        id: seats.id,
        seatNumber: seats.seatNumber,
        qrCode: seats.qrCode,
        qrCodeVersion: seats.qrCodeVersion,
      })
      .from(seats)
      .where(eq(seats.tableId, tableId))
      .orderBy(asc(seats.seatNumber));
    expect(before).toHaveLength(6);

    const result = await service.batchGenerateSeatQRCodes(tableId);
    expect(result.success).toBe(true);
    expect(result.qrCodes).toHaveLength(6);

    const after = await testDb.drizzle
      .select({
        id: seats.id,
        seatNumber: seats.seatNumber,
        qrCode: seats.qrCode,
        qrCodeVersion: seats.qrCodeVersion,
      })
      .from(seats)
      .where(eq(seats.tableId, tableId))
      .orderBy(asc(seats.seatNumber));

    // Every row moved. A partial write would leave a mix of versions, which for
    // a printed sticker means some seats scan and some do not.
    for (const [i, row] of after.entries()) {
      expect(row.qrCodeVersion, `seat ${row.seatNumber} version`).toBe(
        (before[i].qrCodeVersion ?? 0) + 1,
      );
      expect(row.qrCode, `seat ${row.seatNumber} qr`).not.toBe(
        before[i].qrCode,
      );
      // v2 payload carrying this table's id, and this seat's number
      expect(row.qrCode).toContain(`d=${tableId}`);
      expect(row.qrCode).toContain("f=2");
      expect(row.qrCode).toContain(`n=${row.seatNumber}`);
      expect(row.qrCode).toContain(`v=${row.qrCodeVersion}`);
    }

    // No two seats share a signature, which was the original #73 defect.
    const signatures = after.map((r) => r.qrCode?.split("sig=")[1]);
    expect(new Set(signatures).size).toBe(after.length);
  });

  it("is a no-op for a table with no seats rather than an error", async () => {
    const service = createService(testDb);
    const result = await service.batchGenerateSeatQRCodes(tableId);
    expect(result).toEqual({ success: true, qrCodes: [] });
  });
});

describe("TableService two-phase QR rotation", () => {
  let testDb: TestDatabase;
  let tableId: number;
  let liveQrBefore: string;

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
      name: "Rotation Restaurant",
      type: "restaurant",
      category: "casual",
      address: "1 Rotation St",
      district: "Central",
      city: "Taipei",
      phone: "0200000000",
      settings: {},
      isAvailable: true,
      isActive: true,
      createdAt: new Date("2026-07-30T00:00:00.000Z"),
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
    } as never);
    const created = await createTableService(testDb).createTable({
      restaurantId,
      number: "R1",
      capacity: 4,
    });
    tableId = created.id;
    liveQrBefore = created.qrCode;
    // truncateAll + a full createTable (sign, insert, upgrade) runs close to
    // vitest's 10s hook default against real D1; give it room rather than let
    // the first run of the block flake.
  }, 60_000);

  async function readRow() {
    const [row] = await testDb.drizzle
      .select({
        qrCode: tables.qrCode,
        qrCodeVersion: tables.qrCodeVersion,
        pendingQrCode: tables.pendingQrCode,
        pendingQrCodeVersion: tables.pendingQrCodeVersion,
        pendingQrPreparedAt: tables.pendingQrPreparedAt,
      })
      .from(tables)
      .where(eq(tables.id, tableId));
    return row;
  }

  it("leaves the live code untouched while a rotation is prepared", async () => {
    const service = createTableService(testDb);
    const prepared = await service.prepareQRCodeRotation(tableId);

    expect(prepared.success).toBe(true);
    const row = await readRow();
    // The whole point: the sticker already on the table keeps working while its
    // replacement is being printed.
    expect(row.qrCode).toBe(liveQrBefore);
    expect(row.qrCodeVersion).toBe(1);
    expect(row.pendingQrCode).toBe(prepared.qrCode);
    expect(row.pendingQrCodeVersion).toBe(2);
    expect(row.pendingQrPreparedAt).toBeInstanceOf(Date);
    expect(row.pendingQrCode).not.toBe(row.qrCode);
    expect(row.pendingQrCode).toContain(`d=${tableId}`);
    expect(row.pendingQrCode).toContain("v=2");
  });

  it("is idempotent, so re-preparing cannot orphan a printed sticker", async () => {
    const service = createTableService(testDb);
    const first = await service.prepareQRCodeRotation(tableId);
    const second = await service.prepareQRCodeRotation(tableId);

    expect(second.qrCode).toBe(first.qrCode);
    expect((await readRow()).pendingQrCodeVersion).toBe(2);
  });

  it("promotes the prepared code on activation and clears the staging columns", async () => {
    const service = createTableService(testDb);
    const prepared = await service.prepareQRCodeRotation(tableId);
    const activated = await service.activateQRCodeRotation(tableId);

    expect(activated).toEqual({ success: true, qrCode: prepared.qrCode });
    const row = await readRow();
    expect(row.qrCode).toBe(prepared.qrCode);
    expect(row.qrCodeVersion).toBe(2);
    expect(row.pendingQrCode).toBeNull();
    expect(row.pendingQrCodeVersion).toBeNull();
    expect(row.pendingQrPreparedAt).toBeNull();
  });

  it("refuses to activate when nothing was prepared", async () => {
    const service = createTableService(testDb);
    await expect(service.activateQRCodeRotation(tableId)).resolves.toEqual({
      success: false,
      error: "No prepared QR code to activate",
    });
    expect((await readRow()).qrCode).toBe(liveQrBefore);
  });

  it("discards a rotation without disturbing the live code", async () => {
    const service = createTableService(testDb);
    await service.prepareQRCodeRotation(tableId);
    await service.discardQRCodeRotation(tableId);

    const row = await readRow();
    expect(row.qrCode).toBe(liveQrBefore);
    expect(row.qrCodeVersion).toBe(1);
    expect(row.pendingQrCode).toBeNull();
  });

  it("allows a fresh rotation after one is discarded", async () => {
    const service = createTableService(testDb);
    const first = await service.prepareQRCodeRotation(tableId);
    await service.discardQRCodeRotation(tableId);
    const second = await service.prepareQRCodeRotation(tableId);

    expect(second.success).toBe(true);
    // Same version — the discarded one was never live, so it consumed nothing.
    expect((await readRow()).pendingQrCodeVersion).toBe(2);
    expect(second.qrCode).not.toBe(first.qrCode);
  });
});
