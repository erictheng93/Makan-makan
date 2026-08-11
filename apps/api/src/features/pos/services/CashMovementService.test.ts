import { beforeEach, describe, expect, it, vi } from "vitest";
import { CashMovementService } from "./CashMovementService";

const mocks = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

const uuidMocks = vi.hoisted(() => ({ generateUUID: vi.fn() }));

vi.mock("@makanmasak/utils", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  generateUUID: uuidMocks.generateUUID,
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResults(results: unknown[]) {
  mocks.db.select.mockImplementation(() => createQuery(results.shift() ?? []));
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  mocks.db.insert.mockImplementation(() => {
    const builder = {
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return builder;
      }),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  return { inserted, updated };
}

function createService() {
  return new CashMovementService({} as D1Database);
}

async function withSuppressedConsoleError<T>(action: () => Promise<T>) {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  try {
    return await action();
  } finally {
    consoleError.mockRestore();
  }
}

function movementRequest(overrides: Record<string, unknown> = {}) {
  return {
    type: "cash_in" as const,
    amount: 123.45,
    description: "Starting cash",
    referenceId: 101,
    referenceType: "manual",
    denominationBreakdown: { "100": 1, "20": 1, "1": 3 },
    ...overrides,
  };
}

function movementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "movement-1",
    shiftId: "shift-1",
    registerId: "register-1",
    type: "cash_in",
    amountCents: 12345,
    description: "Starting cash",
    referenceId: 101,
    referenceType: "manual",
    denominationBreakdown: JSON.stringify({ "100": 1 }),
    recordedBy: 7,
    approvalStatus: "approved",
    metadata: JSON.stringify({ source: "pos" }),
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
    ...overrides,
  };
}

describe("CashMovementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("processes movements for active shifts and records cent values", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    uuidMocks.generateUUID.mockReturnValue("movement-1");
    const mutations = mockMutations();
    mockSelectResults([[{ status: "active", registerId: "register-1" }]]);

    const result = await createService().processCashMovement(
      "shift-1",
      movementRequest(),
      7,
    );

    expect(result).toEqual({ success: true });
    expect(mutations.inserted).toEqual([
      expect.objectContaining({
        id: "movement-1",
        shiftId: "shift-1",
        registerId: "register-1",
        type: "cash_in",
        amountCents: 12345,
        description: "Starting cash",
        referenceId: 101,
        referenceType: "manual",
        denominationBreakdown: JSON.stringify({ "100": 1, "20": 1, "1": 3 }),
        recordedBy: 7,
        approvalStatus: "approved",
        metadata: "{}",
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
      }),
    ]);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rejects invalid movements and inactive shifts before insert", async () => {
    const mutations = mockMutations();

    let result = await withSuppressedConsoleError(() =>
      createService().processCashMovement(
        "shift-1",
        movementRequest({ type: "sale" }),
        7,
      ),
    );

    expect(result.success).toBe(false);
    expect(mutations.inserted).toHaveLength(0);
    expect(mocks.db.select).not.toHaveBeenCalled();

    mockSelectResults([[{ status: "closed", registerId: "register-1" }], []]);
    result = await createService().processCashMovement(
      "shift-1",
      movementRequest(),
      7,
    );

    expect(result.success).toBe(false);
    expect(mutations.inserted).toHaveLength(0);

    result = await createService().processCashMovement(
      "missing-shift",
      movementRequest(),
      7,
    );

    expect(result.success).toBe(false);
    expect(mutations.inserted).toHaveLength(0);
  });

  it("lists cash movements with parsed JSON fields and pagination", async () => {
    mockSelectResults([
      [
        movementRow({ id: "movement-1" }),
        movementRow({
          id: "movement-2",
          denominationBreakdown: "",
          metadata: "",
        }),
      ],
    ]);

    const result = await createService().getCashMovements("shift-1", {
      type: "cash_in",
      page: 2,
      limit: 2,
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        movements: [
          {
            id: "movement-1",
            denominationBreakdown: { "100": 1 },
            metadata: { source: "pos" },
          },
          {
            id: "movement-2",
            denominationBreakdown: {},
            metadata: {},
          },
        ],
        pagination: { page: 2, limit: 2, hasMore: true },
      },
    });
  });

  it("returns register cash counts with optional date filtering", async () => {
    mockSelectResults([
      [
        movementRow({
          id: "count-1",
          type: "count",
          denominationBreakdown: JSON.stringify({ "500": 2 }),
          metadata: JSON.stringify({ countedBy: "cashier" }),
        }),
      ],
      [],
    ]);

    let result = await createService().getCashCount("register-1", "2026-06-07");

    expect(result).toMatchObject({
      success: true,
      data: [
        {
          id: "count-1",
          type: "count",
          denominationBreakdown: { "500": 2 },
          metadata: { countedBy: "cashier" },
        },
      ],
    });

    result = await createService().getCashCount("register-1");

    expect(result).toEqual({ success: true, data: [] });
  });

  it("approves and rejects pending movements", async () => {
    const mutations = mockMutations();

    await expect(
      createService().approveCashMovement("movement-1", 8),
    ).resolves.toEqual({ success: true });
    await expect(
      createService().rejectCashMovement("movement-2", 9, "count mismatch"),
    ).resolves.toEqual({ success: true });
    await expect(
      createService().rejectCashMovement("movement-3", 10),
    ).resolves.toEqual({ success: true });

    expect(mutations.updated).toEqual([
      {
        approvalStatus: "approved",
        approvedBy: 8,
      },
      {
        approvalStatus: "rejected",
        approvedBy: 9,
        metadata: JSON.stringify({ rejection_reason: "count mismatch" }),
      },
      {
        approvalStatus: "rejected",
        approvedBy: 10,
        metadata: "{}",
      },
    ]);
  });

  it("maps select and mutation failures to service errors", async () => {
    mocks.db.select.mockImplementation(() => {
      throw new Error("select down");
    });

    await expect(
      withSuppressedConsoleError(() =>
        createService().getCashMovements("shift-1"),
      ),
    ).resolves.toMatchObject({
      success: false,
      error: "select down",
    });

    mocks.db.select.mockReset();
    mocks.db.update.mockImplementation(() => {
      throw new Error("update down");
    });

    await expect(
      withSuppressedConsoleError(() =>
        createService().approveCashMovement("movement-1", 8),
      ),
    ).resolves.toEqual({
      success: false,
      error: "update down",
    });
  });
});
