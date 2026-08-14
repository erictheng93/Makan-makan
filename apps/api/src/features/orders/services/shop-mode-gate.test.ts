import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";
import {
  assertShopModeEnabled,
  assertShopOrderingEnabled,
  assertShopQrCurrent,
} from "./shop-mode-gate";

const getShopOrderingState = vi.hoisted(() => vi.fn());

vi.mock("@makanmasak/database", () => ({
  RestaurantService: function RestaurantService() {
    return { getShopOrderingState };
  },
}));

const LIVE_QR_CODE = "SHOP-restaurant-1-1785563580";
const RETIRED_QR_CODE = "SHOP-restaurant-1-1780000000";

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

describe("assertShopQrCurrent", () => {
  it("passes the code that is currently printed", () => {
    expect(() => assertShopQrCurrent(LIVE_QR_CODE, LIVE_QR_CODE)).not.toThrow();
  });

  it("retires a code the owner has regenerated away from", async () => {
    await expectApiError(
      () => assertShopQrCurrent(LIVE_QR_CODE, RETIRED_QR_CODE),
      "SHOP_QR_REVOKED",
    );
  });

  it("skips the check when the client sent nothing to check", () => {
    // Clients that predate the field, waiting-list links, bookmarked menus.
    // Rejecting these would break ordering for everyone mid-session.
    expect(() => assertShopQrCurrent(LIVE_QR_CODE, undefined)).not.toThrow();
    expect(() => assertShopQrCurrent(LIVE_QR_CODE, "")).not.toThrow();
  });

  it("rejects a scanned code when the shop has none on file", async () => {
    await expectApiError(
      () => assertShopQrCurrent(null, RETIRED_QR_CODE),
      "SHOP_QR_REVOKED",
    );
  });
});

describe("assertShopOrderingEnabled", () => {
  function mockState(state: unknown) {
    getShopOrderingState.mockReset();
    getShopOrderingState.mockResolvedValue(state);
  }

  it("looks the restaurant up and passes when shop mode is on", async () => {
    mockState({ enableShopMode: true, shopQrCode: LIVE_QR_CODE });

    await expect(
      assertShopOrderingEnabled(createEnv(), "restaurant-1"),
    ).resolves.toBeUndefined();
    expect(getShopOrderingState).toHaveBeenCalledWith("restaurant-1");
  });

  it("rejects when the owner turned shop mode off", async () => {
    mockState({ enableShopMode: false, shopQrCode: LIVE_QR_CODE });

    await expect(
      assertShopOrderingEnabled(createEnv(), "restaurant-1"),
    ).rejects.toMatchObject({ code: "SHOP_MODE_DISABLED", status: 403 });
  });

  it("rejects a superseded sticker even while shop mode is on", async () => {
    mockState({ enableShopMode: true, shopQrCode: LIVE_QR_CODE });

    await expect(
      assertShopOrderingEnabled(createEnv(), "restaurant-1", RETIRED_QR_CODE),
    ).rejects.toMatchObject({ code: "SHOP_QR_REVOKED", status: 403 });
  });

  it("accepts the live sticker", async () => {
    mockState({ enableShopMode: true, shopQrCode: LIVE_QR_CODE });

    await expect(
      assertShopOrderingEnabled(createEnv(), "restaurant-1", LIVE_QR_CODE),
    ).resolves.toBeUndefined();
  });

  it("answers 404 for a restaurant that does not exist", async () => {
    mockState(null);

    await expect(
      assertShopOrderingEnabled(createEnv(), "missing"),
    ).rejects.toMatchObject({ code: "RESTAURANT_NOT_FOUND", status: 404 });
  });
});
