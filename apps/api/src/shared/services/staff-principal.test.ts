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
  it("normalizes legacy numeric ids and UUID public ids", () => {
    expect(toStaffPrincipalLookupInput(7)).toEqual({ legacyUserId: 7 });
    expect(toStaffPrincipalLookupInput("7")).toEqual({ legacyUserId: 7 });
    expect(
      toStaffPrincipalLookupInput(" 018f0000-0000-7000-8000-000000000777 "),
    ).toEqual({ publicUserId: "018f0000-0000-7000-8000-000000000777" });
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

  it("resolves active legacy numeric users", async () => {
    const db = createDb([
      {
        id: 7,
        public_id: "018f0000-0000-7000-8000-000000000777",
        username: "owner",
        role: 1,
        restaurant_id: "restaurant-1",
        is_active: 1,
        token_version: 2,
      },
    ]);

    const principal = await resolveStaffPrincipal(db, "7");

    expect(principal).toEqual({
      legacyUserId: 7,
      publicUserId: "018f0000-0000-7000-8000-000000000777",
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

  it("resolves active UUID public users", async () => {
    const publicUserId = "018f0000-0000-7000-8000-000000000888";
    const db = createDb([
      {
        id: 8,
        public_id: publicUserId,
        username: "chef",
        role: 2,
        restaurant_id: null,
        is_active: true,
        token_version: null,
      },
    ]);

    const principal = await resolveStaffPrincipal(db, publicUserId);

    expect(principal).toMatchObject({
      legacyUserId: 8,
      publicUserId,
      username: "chef",
      role: 2,
      isActive: true,
      tokenVersion: 1,
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE `public_id` = ?"),
    );
  });

  it("rejects inactive users by default", async () => {
    await expect(
      resolveStaffPrincipal(
        createDb([
          {
            id: 9,
            public_id: "018f0000-0000-7000-8000-000000000999",
            username: "inactive",
            role: 4,
            restaurant_id: null,
            is_active: 0,
            token_version: 1,
          },
        ]),
        9,
      ),
    ).rejects.toMatchObject({
      code: "STAFF_PRINCIPAL_INACTIVE",
      status: 403,
    });
  });

  it("can return inactive users for compatibility callers", async () => {
    const principal = await resolveStaffPrincipal(
      createDb([
        {
          id: 9,
          public_id: "018f0000-0000-7000-8000-000000000999",
          username: "inactive",
          role: 4,
          restaurant_id: null,
          is_active: 0,
          token_version: 1,
        },
      ]),
      9,
      { requireActive: false },
    );

    expect(principal).toMatchObject({
      legacyUserId: 9,
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
