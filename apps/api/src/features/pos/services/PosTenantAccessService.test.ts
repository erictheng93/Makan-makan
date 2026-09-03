import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cashMovements,
  cashRegisters,
  cashShifts,
  receipts,
  refunds,
} from "@makanmasak/database";
import {
  createSelectFixtureDb,
  type SelectFixtures,
} from "@makanmasak/database/testing";
import type { AuthUser } from "../../../middleware/auth";
import { PosTenantAccessService } from "./PosTenantAccessService";

const mocks = vi.hoisted(() => ({ db: { select: vi.fn() } }));

vi.mock("drizzle-orm/d1", () => ({ drizzle: vi.fn(() => mocks.db) }));

const fixtureTables = {
  cashMovements,
  cashRegisters,
  cashShifts,
  receipts,
  refunds,
};
type FixtureName = keyof typeof fixtureTables;

function mockSelectResults(fixtures: SelectFixtures<FixtureName>) {
  Object.assign(mocks.db, createSelectFixtureDb(fixtureTables, fixtures));
}

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    username: "owner",
    role: 1,
    restaurantId: "restaurant-1",
    ...overrides,
  };
}

function service() {
  return new PosTenantAccessService({} as D1Database);
}

describe("PosTenantAccessService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows same-tenant register, shift, and receipt resources", async () => {
    mockSelectResults({
      cashRegisters: [[{ restaurantId: "restaurant-1" }]],
      cashShifts: [[{ restaurantId: "restaurant-1" }]],
      receipts: [
        [
          {
            registerRestaurantId: "restaurant-1",
            orderRestaurantId: "restaurant-1",
          },
        ],
      ],
    });

    await expect(
      service().requireRegister(user(), "register-1"),
    ).resolves.toBeUndefined();
    await expect(
      service().requireShift(user(), "shift-1"),
    ).resolves.toBeUndefined();
    await expect(
      service().requireReceipt(user(), "receipt-1"),
    ).resolves.toBeUndefined();
  });

  it("rejects foreign refund resources with 403", async () => {
    mockSelectResults({
      refunds: [[{ restaurantId: "restaurant-2" }]],
    });

    await expect(
      service().requireRefund(user(), "refund-1"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("returns 404 for a missing cash movement", async () => {
    mockSelectResults({ cashMovements: [[]] });

    await expect(
      service().requireCashMovement(user(), "movement-1"),
    ).rejects.toMatchObject({
      code: "CASH_MOVEMENT_NOT_FOUND",
      status: 404,
    });
  });

  it("rejects a shift that does not belong to the supplied register", async () => {
    mockSelectResults({
      cashRegisters: [[{ restaurantId: "restaurant-1" }]],
      cashShifts: [
        [{ registerId: "register-2", restaurantId: "restaurant-1" }],
      ],
    });

    await expect(
      service().requireRegisterAndShift(user(), "register-1", "shift-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("lets admins cross tenant boundaries but still enforces consistency", async () => {
    const admin = user({ role: 0, restaurantId: undefined });
    mockSelectResults({
      cashRegisters: [
        [{ restaurantId: "restaurant-2" }],
        [{ restaurantId: "restaurant-2" }],
      ],
      cashShifts: [
        [{ registerId: "register-2", restaurantId: "restaurant-2" }],
        [{ registerId: "register-3", restaurantId: "restaurant-2" }],
      ],
    });

    await expect(
      service().requireRegisterAndShift(admin, "register-2", "shift-2"),
    ).resolves.toBeUndefined();
    await expect(
      service().requireRegisterAndShift(admin, "register-2", "shift-3"),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });
});
