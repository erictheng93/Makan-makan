import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";
import {
  assertShopModeEnabled,
  assertShopOrderingEnabled,
} from "./shop-mode-gate";

const isShopModeEnabled = vi.hoisted(() => vi.fn());

vi.mock("@makanmasak/database", () => ({
  RestaurantService: function RestaurantService() {
    return { isShopModeEnabled };
  },
}));

function createEnv() {
  return { DB: {}, JWT_SECRET: "test" } as never;
}

async function expectApiError(action: () => unknown, code: string) {
  await expect(Promise.resolve().then(action)).rejects.toMatchObject({
    code,
  });
  await expect(Promise.resolve().then(action)).rejects.toBeInstanceOf(ApiError);
}

describe("assertShopModeEnabled", () => {
  it("passes an enabled shop through", () => {
    expect(() => assertShopModeEnabled(true)).not.toThrow();
  });

  it("rejects a disabled shop with a stable code", async () => {
    await expectApiError(
      () => assertShopModeEnabled(false),
      "SHOP_MODE_DISABLED",
    );
  });

  it("treats an absent flag as disabled", async () => {
    // A caller reading the column off a partial projection can hand us
    // undefined; defaulting that to "allowed" would reopen the hole.
    await expectApiError(
      () => assertShopModeEnabled(undefined),
      "SHOP_MODE_DISABLED",
    );
    await expectApiError(
      () => assertShopModeEnabled(null),
      "SHOP_MODE_DISABLED",
    );
  });
});

describe("assertShopOrderingEnabled", () => {
  it("looks the restaurant up and passes when shop mode is on", async () => {
    isShopModeEnabled.mockReset();
    isShopModeEnabled.mockResolvedValue(true);

    await expect(
      assertShopOrderingEnabled(createEnv(), "restaurant-1"),
    ).resolves.toBeUndefined();
    expect(isShopModeEnabled).toHaveBeenCalledWith("restaurant-1");
  });

  it("rejects when the owner turned shop mode off", async () => {
    isShopModeEnabled.mockReset();
    isShopModeEnabled.mockResolvedValue(false);

    await expect(
      assertShopOrderingEnabled(createEnv(), "restaurant-1"),
    ).rejects.toMatchObject({ code: "SHOP_MODE_DISABLED", status: 403 });
  });

  it("answers 404 for a restaurant that does not exist", async () => {
    isShopModeEnabled.mockReset();
    isShopModeEnabled.mockResolvedValue(null);

    await expect(
      assertShopOrderingEnabled(createEnv(), "missing"),
    ).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND", status: 404 });
  });
});
