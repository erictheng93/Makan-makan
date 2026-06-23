import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../utils/api-error";
import {
  resolveStaffPrincipal,
  toStaffPrincipalLookupInput,
  type StaffPrincipalRow,
} from "./staff-principal";

function createDb(rows: Array<StaffPrincipalRow | null>) {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...bindings: unknown[]) => ({
        first: vi.fn(async () => rows.shift() ?? null),
        sql,
        bindings,
      })),
    })),
  } as unknown as D1Database;
}

describe("staff principal resolver", () => {
  it("normalizes UUID staff principal ids", () => {
    expect(
      toStaffPrincipalLookupInput(" 018f0000-0000-7000-8000-000000000777 "),
    ).toEqual({ userId: "018f0000-0000-7000-8000-000000000777" });
  });

  it("rejects invalid staff principals before querying", async () => {
    await expect(resolveStaffPrincipal(createDb([]), "")).rejects.toMatchObject(
      {
        code: "STAFF_PRINCIPAL_INVALID",
        status: 400,
      },
    );
    await expect(resolveStaffPrincipal(createDb([]), 0)).rejects.toMatchObject({
      code: "STAFF_PRINCIPAL_INVALID",
      status: 400,
    });
    await expect(
      resolveStaffPrincipal(createDb([]), "owner@example.test"),
    ).rejects.toMatchObject({
      code: "STAFF_PRINCIPAL_INVALID",
      status: 400,
    });
  });

  it("resolves active UUID users", async () => {
    const userId = "018f0000-0000-7000-8000-000000000777";
    const db = createDb([
      {
        id: userId,
        username: "owner",
        role: 1,
        restaurant_id: "restaurant-1",
        is_active: 1,
        token_version: 2,
      },
    ]);

    const principal = await resolveStaffPrincipal(db, userId);

    expect(principal).toEqual({
      id: userId,
      publicUserId: userId,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
      isActive: true,
      tokenVersion: 2,
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE `id` = ?"),
    );
  });

  it("uses users.id for UUID principal lookup", async () => {
    const userId = "018f0000-0000-7000-8000-000000000888";
    const db = createDb([
      {
        id: userId,
        username: "chef",
        role: 2,
        restaurant_id: null,
        is_active: true,
        token_version: null,
      },
    ]);

    const principal = await resolveStaffPrincipal(db, userId);

    expect(principal).toMatchObject({
      id: userId,
      publicUserId: userId,
      username: "chef",
      role: 2,
      isActive: true,
      tokenVersion: 1,
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE `id` = ?"),
    );
  });

  it("rejects inactive users by default", async () => {
    const userId = "018f0000-0000-7000-8000-000000000999";
    await expect(
      resolveStaffPrincipal(
        createDb([
          {
            id: userId,
            username: "inactive",
            role: 4,
            restaurant_id: null,
            is_active: 0,
            token_version: 1,
          },
        ]),
        userId,
      ),
    ).rejects.toMatchObject({
      code: "STAFF_PRINCIPAL_INACTIVE",
      status: 403,
    });
  });

  it("can return inactive users for compatibility callers", async () => {
    const userId = "018f0000-0000-7000-8000-000000000999";
    const principal = await resolveStaffPrincipal(
      createDb([
        {
          id: userId,
          username: "inactive",
          role: 4,
          restaurant_id: null,
          is_active: 0,
          token_version: 1,
        },
      ]),
      userId,
      { requireActive: false },
    );

    expect(principal).toMatchObject({
      id: userId,
      isActive: false,
    });
  });

  it("maps misses to STAFF_PRINCIPAL_NOT_FOUND", async () => {
    await expect(
      resolveStaffPrincipal(
        createDb([null]),
        "018f0000-0000-7000-8000-000000000404",
      ),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      resolveStaffPrincipal(
        createDb([null]),
        "018f0000-0000-7000-8000-000000000404",
      ),
    ).rejects.toMatchObject({
      code: "STAFF_PRINCIPAL_NOT_FOUND",
      status: 404,
    });
  });
});
